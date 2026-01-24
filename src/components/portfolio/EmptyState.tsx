import { motion } from 'framer-motion';
import { Database, TrendingUp, FileSpreadsheet, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface EmptyStateProps {
  title: string;
  description: string;
  onNavigateToSources?: () => void;
}

export function EmptyState({ title, description, onNavigateToSources }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex items-center justify-center min-h-[400px]"
    >
      <Card className="max-w-md w-full border-border bg-card/50 backdrop-blur-sm">
        <CardContent className="pt-6 pb-6 text-center space-y-6">
          <div className="flex justify-center">
            <div className="p-4 rounded-full bg-muted">
              <Database className="h-12 w-12 text-muted-foreground" />
            </div>
          </div>
          
          <div className="space-y-2">
            <h3 className="text-xl font-semibold text-foreground">{title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {description}
            </p>
          </div>

          {onNavigateToSources && (
            <>
              <div className="pt-2">
                <Button 
                  onClick={onNavigateToSources}
                  className="w-full"
                  size="lg"
                >
                  <Database className="h-4 w-4 mr-2" />
                  Go to Data Sources
                </Button>
              </div>

              <div className="pt-4 border-t border-border">
                <p className="text-xs text-muted-foreground mb-3">Available data sources:</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-orange-500/10 text-orange-500 text-xs">
                    <TrendingUp className="h-3 w-3" />
                    Zerodha
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-500/10 text-blue-500 text-xs">
                    <FileSpreadsheet className="h-3 w-3" />
                    INDMoney
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-green-500/10 text-green-500 text-xs">
                    <Building2 className="h-3 w-3" />
                    Mutual Funds
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
