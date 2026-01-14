import { motion } from 'framer-motion';
import { Building2, Clock } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';

interface BrokerInfo {
  name: string;
  description: string;
  icon?: React.ReactNode;
  color: string;
}

const BROKERS: Record<string, BrokerInfo> = {
  'angel': {
    name: 'Angel One',
    description: 'Angel Broking SmartAPI',
    color: 'text-red-400',
  },
  'groww': {
    name: 'Groww',
    description: 'Stocks & Mutual Funds',
    color: 'text-green-400',
  },
  'hdfc': {
    name: 'HDFC Securities',
    description: 'HDFC Bank Integration',
    color: 'text-blue-400',
  },
  'icici': {
    name: 'ICICI Direct',
    description: 'ICICIdirect API',
    color: 'text-orange-400',
  },
};

interface BrokerPlaceholderCardProps {
  brokerId: keyof typeof BROKERS;
  delay?: number;
}

export function BrokerPlaceholderCard({ brokerId, delay = 0 }: BrokerPlaceholderCardProps) {
  const broker = BROKERS[brokerId];

  const handleClick = () => {
    toast.info('Feature in development', {
      description: `${broker.name} integration is coming soon!`,
      icon: <Clock className="h-4 w-4" />,
    });
  };

  if (!broker) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay }}
            onClick={handleClick}
            className="cursor-pointer"
          >
            <Card className="border-border bg-card/30 backdrop-blur-sm opacity-50 hover:opacity-70 transition-all duration-300 relative overflow-hidden group">
              {/* Coming Soon Overlay */}
              <div className="absolute inset-0 bg-gradient-to-br from-transparent to-muted/20 pointer-events-none" />
              
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-muted/50 grayscale">
                      <Building2 className={`h-5 w-5 ${broker.color}`} />
                    </div>
                    <div>
                      <CardTitle className="text-lg text-muted-foreground">{broker.name}</CardTitle>
                      <CardDescription>{broker.description}</CardDescription>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-muted-foreground border-muted-foreground/30">
                    <Clock className="h-3 w-3 mr-1" />
                    Coming Soon
                  </Badge>
                </div>
              </CardHeader>

              <CardContent>
                <div className="h-20 flex items-center justify-center text-muted-foreground/50 border-2 border-dashed border-border/50 rounded-lg">
                  <span className="text-sm">Integration coming soon</span>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{broker.name} integration is in development</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Export the list of available brokers for iteration
export const AVAILABLE_BROKERS = Object.keys(BROKERS) as Array<keyof typeof BROKERS>;
