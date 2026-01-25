import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MFCentralRequest {
  action: 'request_otp' | 'verify_otp' | 'fetch_cas';
  pan: string;
  phone?: string;
  email?: string;
  otp_method?: 'phone' | 'email';
  otp?: string;
  otp_reference?: string;
  time_period?: 'since_last_update' | 'custom';
  updated_till?: string;
  nickname?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      throw new Error('Unauthorized');
    }

    const requestData: MFCentralRequest = await req.json();
    const { action, pan, phone, email, otp_method, otp, otp_reference, time_period, updated_till, nickname } = requestData;

    // MFCentral CAS API base URL (placeholder - replace with actual API endpoint)
    const MF_CENTRAL_API_URL = Deno.env.get('MF_CENTRAL_API_URL') || 'https://api.mfcentral.com/cas';
    const MF_CENTRAL_API_KEY = Deno.env.get('MF_CENTRAL_API_KEY') || '';

    let response;

    switch (action) {
      case 'request_otp': {
        // Step 1: Request OTP from MFCentral
        const otpResponse = await fetch(`${MF_CENTRAL_API_URL}/request-otp`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${MF_CENTRAL_API_KEY}`,
          },
          body: JSON.stringify({
            pan: pan.toUpperCase(),
            [otp_method === 'phone' ? 'mobile' : 'email']: otp_method === 'phone' ? phone : email,
            otp_method,
          }),
        });

        if (!otpResponse.ok) {
          throw new Error('Failed to request OTP from MFCentral');
        }

        const otpData = await otpResponse.json();

        // Store sync request in database
        const { data: syncRecord, error: syncError } = await supabaseClient
          .from('mf_cas_sync')
          .insert({
            user_id: user.id,
            pan: pan.toUpperCase(),
            phone: otp_method === 'phone' ? phone : null,
            email: otp_method === 'email' ? email : null,
            otp_method,
            otp_reference: otpData.reference_id || otpData.otp_reference,
            sync_status: 'otp_sent',
            time_period,
            updated_till,
            nickname,
          })
          .select()
          .single();

        if (syncError) {
          throw syncError;
        }

        response = {
          success: true,
          message: 'OTP sent successfully',
          sync_id: syncRecord.id,
          otp_reference: otpData.reference_id || otpData.otp_reference,
        };
        break;
      }

      case 'verify_otp': {
        // Step 2: Verify OTP and get CAS data
        const verifyResponse = await fetch(`${MF_CENTRAL_API_URL}/verify-otp`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${MF_CENTRAL_API_KEY}`,
          },
          body: JSON.stringify({
            pan: pan.toUpperCase(),
            otp,
            reference_id: otp_reference,
          }),
        });

        if (!verifyResponse.ok) {
          // Update sync status to failed
          await supabaseClient
            .from('mf_cas_sync')
            .update({
              sync_status: 'failed',
              error_message: 'Invalid OTP',
            })
            .eq('otp_reference', otp_reference);

          throw new Error('Invalid OTP');
        }

        const verifyData = await verifyResponse.json();

        // Update sync status to verified
        await supabaseClient
          .from('mf_cas_sync')
          .update({
            sync_status: 'verified',
          })
          .eq('otp_reference', otp_reference);

        response = {
          success: true,
          message: 'OTP verified successfully',
          access_token: verifyData.access_token,
        };
        break;
      }

      case 'fetch_cas': {
        // Step 3: Fetch CAS data
        const casResponse = await fetch(`${MF_CENTRAL_API_URL}/fetch-cas`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${MF_CENTRAL_API_KEY}`,
          },
          body: JSON.stringify({
            pan: pan.toUpperCase(),
            reference_id: otp_reference,
            time_period,
            updated_till,
          }),
        });

        if (!casResponse.ok) {
          throw new Error('Failed to fetch CAS data');
        }

        const casData = await casResponse.json();

        // Update sync status to syncing
        await supabaseClient
          .from('mf_cas_sync')
          .update({
            sync_status: 'syncing',
          })
          .eq('otp_reference', otp_reference);

        // Process and store CAS data
        await processCASData(supabaseClient, user.id, pan.toUpperCase(), casData);

        // Update sync status to completed
        await supabaseClient
          .from('mf_cas_sync')
          .update({
            sync_status: 'completed',
            last_synced_at: new Date().toISOString(),
          })
          .eq('otp_reference', otp_reference);

        response = {
          success: true,
          message: 'CAS data synced successfully',
          holdings_count: casData.folios?.length || 0,
        };
        break;
      }

      default:
        throw new Error('Invalid action');
    }

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Error in mf-cas-sync function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});

async function processCASData(supabaseClient: any, userId: string, pan: string, casData: any) {
  // Parse and store folio data
  const folios = casData.folios || [];

  for (const folio of folios) {
    // Insert or update folio
    const { data: folioRecord, error: folioError } = await supabaseClient
      .from('mf_folios')
      .upsert({
        user_id: userId,
        pan,
        folio_number: folio.folio_number,
        amc_name: folio.amc_name,
        amc_code: folio.amc_code,
        scheme_name: folio.scheme_name,
        scheme_code: folio.scheme_code,
        isin: folio.isin,
        advisor: folio.advisor,
        registrar: folio.registrar,
      }, {
        onConflict: 'user_id,folio_number,scheme_code',
      })
      .select()
      .single();

    if (folioError) {
      console.error('Error inserting folio:', folioError);
      continue;
    }

    // Insert transactions
    const transactions = folio.transactions || [];
    for (const txn of transactions) {
      await supabaseClient
        .from('mf_transactions')
        .upsert({
          user_id: userId,
          folio_id: folioRecord.id,
          pan,
          folio_number: folio.folio_number,
          scheme_name: folio.scheme_name,
          scheme_code: folio.scheme_code,
          isin: folio.isin,
          amc_name: folio.amc_name,
          transaction_date: txn.date,
          transaction_type: txn.type,
          amount: txn.amount,
          units: txn.units,
          nav: txn.nav,
          balance_units: txn.balance_units,
          description: txn.description,
          dividend_rate: txn.dividend_rate,
        });
    }

    // Calculate and store holdings summary
    const summary = calculateHoldingsSummary(transactions);
    await supabaseClient
      .from('mf_holdings_summary')
      .upsert({
        user_id: userId,
        folio_id: folioRecord.id,
        pan,
        folio_number: folio.folio_number,
        scheme_name: folio.scheme_name,
        scheme_code: folio.scheme_code,
        isin: folio.isin,
        amc_name: folio.amc_name,
        total_units: summary.total_units,
        current_nav: folio.current_nav,
        current_value: summary.total_units * folio.current_nav,
        invested_value: summary.invested_value,
        total_purchase_units: summary.total_purchase_units,
        total_redemption_units: summary.total_redemption_units,
        total_dividend_amount: summary.total_dividend_amount,
        avg_nav: summary.avg_nav,
        absolute_return: (summary.total_units * folio.current_nav) - summary.invested_value,
        absolute_return_percent: ((summary.total_units * folio.current_nav) - summary.invested_value) / summary.invested_value * 100,
        first_investment_date: summary.first_investment_date,
        last_transaction_date: summary.last_transaction_date,
      }, {
        onConflict: 'user_id,folio_number,scheme_code',
      });
  }
}

function calculateHoldingsSummary(transactions: any[]) {
  let total_units = 0;
  let total_purchase_units = 0;
  let total_redemption_units = 0;
  let total_dividend_amount = 0;
  let invested_value = 0;
  let first_investment_date = null;
  let last_transaction_date = null;

  for (const txn of transactions) {
    const txnDate = new Date(txn.date);
    
    if (!first_investment_date || txnDate < new Date(first_investment_date)) {
      first_investment_date = txn.date;
    }
    
    if (!last_transaction_date || txnDate > new Date(last_transaction_date)) {
      last_transaction_date = txn.date;
    }

    if (txn.type === 'purchase' || txn.type === 'switch_in') {
      total_purchase_units += txn.units || 0;
      invested_value += txn.amount || 0;
    } else if (txn.type === 'redemption' || txn.type === 'switch_out') {
      total_redemption_units += txn.units || 0;
      invested_value -= txn.amount || 0;
    } else if (txn.type === 'dividend') {
      total_dividend_amount += txn.amount || 0;
    }

    total_units = txn.balance_units || 0;
  }

  const avg_nav = total_purchase_units > 0 ? invested_value / total_purchase_units : 0;

  return {
    total_units,
    total_purchase_units,
    total_redemption_units,
    total_dividend_amount,
    invested_value,
    avg_nav,
    first_investment_date,
    last_transaction_date,
  };
}
