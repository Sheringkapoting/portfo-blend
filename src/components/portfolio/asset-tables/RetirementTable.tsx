import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EnrichedHolding } from '@/types/portfolio';
import { formatCurrency, formatPercent } from '@/lib/portfolioUtils';
import { cn } from '@/lib/utils';
import { SourceBadge } from '../SourceBadge';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Info } from 'lucide-react';

interface RetirementTableProps {
  holdings: EnrichedHolding[];
  assetType: 'EPF' | 'PPF' | 'NPS' | 'FD' | 'RD';
}

export function RetirementTable({ holdings, assetType }: RetirementTableProps) {
  const getAssetDescription = (type: string) => {
    switch (type) {
      case 'EPF':
        return 'Employee Provident Fund - Government-backed retirement savings scheme';
      case 'PPF':
        return 'Public Provident Fund - Tax-exempt long-term savings instrument';
      case 'NPS':
        return 'National Pension System - Voluntary retirement savings scheme';
      case 'FD':
        return 'Fixed Deposit - Bank deposit with fixed interest rate';
      case 'RD':
        return 'Recurring Deposit - Regular deposit with fixed returns';
      default:
        return 'Retirement/Savings Asset';
    }
  };

  return (
    <TooltipProvider>
      <div className="rounded-md border border-border/50 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="font-semibold">
                <div className="flex items-center gap-2">
                  Name
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-3.5 w-3.5 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs text-xs">{getAssetDescription(assetType)}</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </TableHead>
              <TableHead className="text-right font-semibold">Invested</TableHead>
              <TableHead className="text-right font-semibold">Current Value</TableHead>
              <TableHead className="text-right font-semibold">Returns</TableHead>
              <TableHead className="text-right font-semibold">P&L</TableHead>
              <TableHead className="text-center font-semibold">Source</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {holdings.map((holding) => {
              const isProfitable = holding.pnl >= 0;
              const returns = holding.investedValue > 0 
                ? ((holding.currentValue - holding.investedValue) / holding.investedValue) * 100 
                : 0;

              return (
                <TableRow key={holding.id} className="table-row-hover">
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium text-foreground">{holding.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {holding.broker || holding.source}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(holding.investedValue, true)}
                  </TableCell>
                  <TableCell className="text-right font-mono font-medium">
                    {formatCurrency(holding.currentValue, true)}
                  </TableCell>
                  <TableCell className={cn(
                    "text-right font-mono font-medium",
                    isProfitable ? "text-profit" : "text-loss"
                  )}>
                    {formatPercent(returns)}
                  </TableCell>
                  <TableCell className={cn(
                    "text-right font-mono font-medium",
                    isProfitable ? "text-profit" : "text-loss"
                  )}>
                    {isProfitable ? '+' : ''}{formatCurrency(holding.pnl, true)}
                  </TableCell>
                  <TableCell className="text-center">
                    <SourceBadge source={holding.source} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </TooltipProvider>
  );
}
