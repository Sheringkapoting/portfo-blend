import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { EnrichedHolding, AssetType } from '@/types/portfolio';
import { AssetClassTable } from './AssetClassTable';

interface AssetClassHoldingsProps {
  holdings: EnrichedHolding[];
}

// Order of asset classes for display
const ASSET_ORDER: AssetType[] = [
  'Equity',
  'Mutual Fund',
  'ETF',
  'US Stock',
  'SGB',
  'Bond',
  'REIT',
  'Commodity',
  'Index',
  'NPS',
  'EPF',
  'PPF',
];

export function AssetClassHoldings({ holdings }: AssetClassHoldingsProps) {
  // Group holdings by asset type
  const groupedHoldings = useMemo(() => {
    const groups = new Map<AssetType, EnrichedHolding[]>();

    holdings.forEach((holding) => {
      const type = holding.type as AssetType;
      if (!groups.has(type)) {
        groups.set(type, []);
      }
      groups.get(type)!.push(holding);
    });

    // Sort groups by predefined order
    const sortedGroups: Array<{ type: AssetType; holdings: EnrichedHolding[] }> = [];
    
    ASSET_ORDER.forEach((type) => {
      if (groups.has(type)) {
        sortedGroups.push({ type, holdings: groups.get(type)! });
      }
    });

    // Add any remaining types not in ASSET_ORDER
    groups.forEach((items, type) => {
      if (!ASSET_ORDER.includes(type)) {
        sortedGroups.push({ type, holdings: items });
      }
    });

    return sortedGroups;
  }, [holdings]);

  if (holdings.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center py-12 text-muted-foreground"
      >
        <p>No holdings found. Connect your broker account to sync your portfolio.</p>
      </motion.div>
    );
  }

  return (
    <div className="space-y-4">
      {groupedHoldings.map(({ type, holdings }, index) => (
        <AssetClassTable
          key={type}
          assetType={type}
          holdings={holdings}
          delay={index * 0.1}
        />
      ))}
    </div>
  );
}
