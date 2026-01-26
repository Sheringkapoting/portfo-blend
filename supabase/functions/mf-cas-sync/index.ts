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

  // Check if we're in demo mode (no real API configured)
    const isDemoMode = !MF_CENTRAL_API_KEY || MF_CENTRAL_API_URL === 'https://api.mfcentral.com/cas';
    
    let response;

    switch (action) {
      case 'request_otp': {
        // Generate a mock OTP reference for demo mode
        const mockOtpReference = `DEMO_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        
        if (!isDemoMode) {
          // Real API call would go here when MFCentral API is available
          throw new Error('MFCentral API integration not configured. Please use demo mode or upload CAS PDF.');
        }

        // Store sync request in database (demo mode)
        const { data: syncRecord, error: syncError } = await supabaseClient
          .from('mf_cas_sync')
          .insert({
            user_id: user.id,
            pan: pan.toUpperCase(),
            phone: otp_method === 'phone' ? phone : null,
            email: otp_method === 'email' ? email : null,
            otp_method,
            otp_reference: mockOtpReference,
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

        console.log(`[DEMO MODE] OTP sent to ${otp_method === 'phone' ? phone : email} for PAN ${pan.toUpperCase()}`);

        response = {
          success: true,
          message: isDemoMode 
            ? 'Demo mode: Use OTP "123456" to verify' 
            : 'OTP sent successfully',
          sync_id: syncRecord.id,
          otp_reference: mockOtpReference,
          otp_method,
          demo_mode: isDemoMode,
        };
        break;
      }

      case 'verify_otp': {
        if (isDemoMode) {
          // In demo mode, accept "123456" as valid OTP
          if (otp !== '123456') {
            await supabaseClient
              .from('mf_cas_sync')
              .update({
                sync_status: 'failed',
                error_message: 'Invalid OTP. Use "123456" in demo mode.',
              })
              .eq('otp_reference', otp_reference);

            throw new Error('Invalid OTP. In demo mode, use "123456"');
          }
        }

        // Update sync status to verified
        await supabaseClient
          .from('mf_cas_sync')
          .update({
            sync_status: 'verified',
          })
          .eq('otp_reference', otp_reference);

        console.log(`[DEMO MODE] OTP verified for reference ${otp_reference}`);

        response = {
          success: true,
          message: 'OTP verified successfully',
          demo_mode: isDemoMode,
        };
        break;
      }

      case 'fetch_cas': {
        // Update sync status to syncing
        await supabaseClient
          .from('mf_cas_sync')
          .update({
            sync_status: 'syncing',
          })
          .eq('otp_reference', otp_reference);

        if (isDemoMode) {
          // Generate demo CAS data
          const demoCASData = generateDemoCASData(pan.toUpperCase());
          
          // Process and store demo CAS data
          await processCASData(supabaseClient, user.id, pan.toUpperCase(), demoCASData);

          // Update sync status to completed
          await supabaseClient
            .from('mf_cas_sync')
            .update({
              sync_status: 'completed',
              last_synced_at: new Date().toISOString(),
            })
            .eq('otp_reference', otp_reference);

          console.log(`[DEMO MODE] Synced ${demoCASData.folios.length} demo folios for PAN ${pan.toUpperCase()}`);

          response = {
            success: true,
            message: 'Demo data synced successfully',
            holdings_count: demoCASData.folios.length,
            demo_mode: true,
          };
        } else {
          throw new Error('MFCentral API integration not configured');
        }
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

// Generate demo CAS data for testing
function generateDemoCASData(pan: string) {
  const demoFolios = [
    {
      folio_number: `${pan.substring(0, 5)}001`,
      amc_name: 'HDFC Mutual Fund',
      amc_code: 'HDFC',
      scheme_name: 'HDFC Flexi Cap Fund - Direct Plan - Growth',
      scheme_code: 'HDFC-FLEX-DG',
      isin: 'INF179K01VV2',
      advisor: 'Direct',
      registrar: 'CAMS',
      current_nav: 1856.45,
      transactions: [
        { date: '2023-01-15', type: 'purchase', amount: 50000, units: 28.54, nav: 1752.12, balance_units: 28.54, description: 'SIP' },
        { date: '2023-06-15', type: 'purchase', amount: 50000, units: 27.12, nav: 1843.89, balance_units: 55.66, description: 'SIP' },
        { date: '2024-01-15', type: 'purchase', amount: 50000, units: 26.95, nav: 1855.29, balance_units: 82.61, description: 'SIP' },
      ],
    },
    {
      folio_number: `${pan.substring(0, 5)}002`,
      amc_name: 'Parag Parikh Mutual Fund',
      amc_code: 'PPFAS',
      scheme_name: 'Parag Parikh Flexi Cap Fund - Direct Plan - Growth',
      scheme_code: 'PPFAS-FLEX-DG',
      isin: 'INF879O01027',
      advisor: 'Direct',
      registrar: 'KFintech',
      current_nav: 78.92,
      transactions: [
        { date: '2022-06-10', type: 'purchase', amount: 100000, units: 1428.57, nav: 70.00, balance_units: 1428.57, description: 'Lumpsum' },
        { date: '2023-12-10', type: 'purchase', amount: 50000, units: 657.89, nav: 76.00, balance_units: 2086.46, description: 'Additional' },
      ],
    },
    {
      folio_number: `${pan.substring(0, 5)}003`,
      amc_name: 'Mirae Asset Mutual Fund',
      amc_code: 'MIRAE',
      scheme_name: 'Mirae Asset Large Cap Fund - Direct Plan - Growth',
      scheme_code: 'MIRAE-LC-DG',
      isin: 'INF769K01101',
      advisor: 'Direct',
      registrar: 'CAMS',
      current_nav: 112.34,
      transactions: [
        { date: '2021-03-20', type: 'purchase', amount: 200000, units: 2040.82, nav: 98.00, balance_units: 2040.82, description: 'Lumpsum' },
        { date: '2022-03-20', type: 'purchase', amount: 100000, units: 943.40, nav: 106.00, balance_units: 2984.22, description: 'Additional' },
        { date: '2023-09-15', type: 'dividend', amount: 5000, units: 0, nav: 110.50, balance_units: 2984.22, description: 'Dividend Payout' },
      ],
    },
  ];

  return { folios: demoFolios };
}

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
