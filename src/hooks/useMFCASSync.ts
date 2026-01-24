import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { MFCASSync, MFHoldingSummary } from '@/types/mutualFund';

interface RequestOTPParams {
  pan: string;
  phone?: string;
  email?: string;
  otp_method: 'phone' | 'email';
  time_period?: string;
  updated_till?: string;
  nickname?: string;
}

interface VerifyOTPParams {
  pan: string;
  otp: string;
  otp_reference: string;
}

interface FetchCASParams {
  pan: string;
  otp_reference: string;
  time_period?: string;
  updated_till?: string;
}

export function useMFCASSync() {
  const queryClient = useQueryClient();
  const [currentSyncId, setCurrentSyncId] = useState<string | null>(null);

  // Fetch latest sync status
  const { data: latestSync, isLoading: isLoadingSync } = useQuery({
    queryKey: ['mf-cas-sync-latest'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mf_cas_sync')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data as MFCASSync | null;
    },
  });

  // Fetch MF holdings summary
  const { data: mfHoldings, isLoading: isLoadingHoldings, refetch: refetchHoldings } = useQuery({
    queryKey: ['mf-holdings-summary'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mf_holdings_summary')
        .select('*')
        .order('current_value', { ascending: false });

      if (error) {
        throw error;
      }

      return data as MFHoldingSummary[];
    },
  });

  // Request OTP mutation
  const requestOTPMutation = useMutation({
    mutationFn: async (params: RequestOTPParams) => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await supabase.functions.invoke('mf-cas-sync', {
        body: {
          action: 'request_otp',
          ...params,
        },
      });

      if (response.error) {
        throw response.error;
      }

      return response.data;
    },
    onSuccess: (data) => {
      setCurrentSyncId(data.sync_id);
      toast.success('OTP sent successfully! Please check your ' + (data.otp_method === 'phone' ? 'phone' : 'email'));
      queryClient.invalidateQueries({ queryKey: ['mf-cas-sync-latest'] });
    },
    onError: (error: Error) => {
      toast.error('Failed to request OTP: ' + error.message);
    },
  });

  // Verify OTP mutation
  const verifyOTPMutation = useMutation({
    mutationFn: async (params: VerifyOTPParams) => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await supabase.functions.invoke('mf-cas-sync', {
        body: {
          action: 'verify_otp',
          ...params,
        },
      });

      if (response.error) {
        throw response.error;
      }

      return response.data;
    },
    onSuccess: () => {
      toast.success('OTP verified successfully!');
      queryClient.invalidateQueries({ queryKey: ['mf-cas-sync-latest'] });
    },
    onError: (error: Error) => {
      toast.error('Invalid OTP: ' + error.message);
    },
  });

  // Fetch CAS data mutation
  const fetchCASMutation = useMutation({
    mutationFn: async (params: FetchCASParams) => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await supabase.functions.invoke('mf-cas-sync', {
        body: {
          action: 'fetch_cas',
          ...params,
        },
      });

      if (response.error) {
        throw response.error;
      }

      return response.data;
    },
    onSuccess: (data) => {
      toast.success(`Successfully synced ${data.holdings_count} mutual fund holdings!`);
      queryClient.invalidateQueries({ queryKey: ['mf-cas-sync-latest'] });
      queryClient.invalidateQueries({ queryKey: ['mf-holdings-summary'] });
      queryClient.invalidateQueries({ queryKey: ['holdings'] });
    },
    onError: (error: Error) => {
      toast.error('Failed to fetch CAS data: ' + error.message);
    },
  });

  return {
    // Sync status
    latestSync,
    isLoadingSync,
    currentSyncId,

    // Holdings
    mfHoldings: mfHoldings || [],
    isLoadingHoldings,
    refetchHoldings,

    // Mutations
    requestOTP: requestOTPMutation.mutate,
    isRequestingOTP: requestOTPMutation.isPending,
    
    verifyOTP: verifyOTPMutation.mutate,
    isVerifyingOTP: verifyOTPMutation.isPending,
    
    fetchCAS: fetchCASMutation.mutate,
    isFetchingCAS: fetchCASMutation.isPending,

    // Combined loading state
    isSyncing: requestOTPMutation.isPending || verifyOTPMutation.isPending || fetchCASMutation.isPending,
  };
}
