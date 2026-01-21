import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, CheckCircle2, XCircle, Clock, RefreshCw, Database, FileSpreadsheet } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { UserMenu } from '@/components/portfolio/UserMenu';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface SyncLog {
  id: string;
  source: string;
  status: string;
  holdings_count: number | null;
  error_message: string | null;
  created_at: string;
}

export default function SyncHistory() {
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'success' | 'error'>('all');

  const fetchLogs = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('sync_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (!error && data) {
      setLogs(data);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter(log => {
    if (filter === 'all') return true;
    if (filter === 'success') return log.status === 'success' || log.status === 'connected';
    if (filter === 'error') return log.status === 'error';
    return true;
  });

  const getSourceIcon = (source: string) => {
    if (source.toLowerCase().includes('zerodha')) {
      return <Database className="h-4 w-4" />;
    }
    return <FileSpreadsheet className="h-4 w-4" />;
  };

  const getStatusBadge = (status: string) => {
    if (status === 'success' || status === 'connected') {
      return (
        <Badge className="bg-profit/20 text-profit border-profit/30 gap-1">
          <CheckCircle2 className="h-3 w-3" />
          {status === 'connected' ? 'Connected' : 'Success'}
        </Badge>
      );
    }
    return (
      <Badge variant="destructive" className="gap-1">
        <XCircle className="h-3 w-3" />
        Error
      </Badge>
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString('en-IN', { 
        day: 'numeric', 
        month: 'short', 
        year: 'numeric' 
      }),
      time: date.toLocaleTimeString('en-IN', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      }),
    };
  };

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  // Calculate stats
  const stats = {
    total: logs.length,
    success: logs.filter(l => l.status === 'success' || l.status === 'connected').length,
    errors: logs.filter(l => l.status === 'error').length,
    totalHoldings: logs.reduce((sum, l) => sum + (l.holdings_count || 0), 0),
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link to="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Sync History</h1>
              <p className="text-muted-foreground text-sm">View all past sync attempts and their results</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={fetchLogs} disabled={isLoading}>
              <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
              Refresh
            </Button>
            <UserMenu />
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card className="bg-card/50">
            <CardContent className="p-4">
              <p className="text-muted-foreground text-sm">Total Syncs</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </CardContent>
          </Card>
          <Card className="bg-card/50">
            <CardContent className="p-4">
              <p className="text-muted-foreground text-sm">Successful</p>
              <p className="text-2xl font-bold text-profit">{stats.success}</p>
            </CardContent>
          </Card>
          <Card className="bg-card/50">
            <CardContent className="p-4">
              <p className="text-muted-foreground text-sm">Failed</p>
              <p className="text-2xl font-bold text-loss">{stats.errors}</p>
            </CardContent>
          </Card>
          <Card className="bg-card/50">
            <CardContent className="p-4">
              <p className="text-muted-foreground text-sm">Success Rate</p>
              <p className="text-2xl font-bold">
                {stats.total > 0 ? Math.round((stats.success / stats.total) * 100) : 0}%
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-4">
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('all')}
          >
            All ({logs.length})
          </Button>
          <Button
            variant={filter === 'success' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('success')}
          >
            Success ({stats.success})
          </Button>
          <Button
            variant={filter === 'error' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('error')}
          >
            Errors ({stats.errors})
          </Button>
        </div>

        {/* Logs List */}
        <Card className="bg-card/50">
          <CardHeader>
            <CardTitle className="text-lg">Sync Logs</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map(i => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No sync logs found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredLogs.map((log, index) => {
                  const { date, time } = formatDate(log.created_at);
                  return (
                    <motion.div
                      key={log.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                      className="flex items-center justify-between p-4 rounded-lg border border-border bg-background/50 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "p-2 rounded-lg",
                          log.source.toLowerCase().includes('zerodha') 
                            ? "bg-orange-500/10 text-orange-500"
                            : "bg-blue-500/10 text-blue-500"
                        )}>
                          {getSourceIcon(log.source)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{log.source}</span>
                            {getStatusBadge(log.status)}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {log.status === 'success' && log.holdings_count !== null ? (
                              <span>{log.holdings_count} holdings synced</span>
                            ) : log.status === 'connected' ? (
                              <span>Broker connection established</span>
                            ) : log.error_message ? (
                              <span className="text-loss">{log.error_message}</span>
                            ) : (
                              <span>No details available</span>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{date}</p>
                        <p className="text-xs text-muted-foreground">{time} • {getTimeAgo(log.created_at)}</p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
