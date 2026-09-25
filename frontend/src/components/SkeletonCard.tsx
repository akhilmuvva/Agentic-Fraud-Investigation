import React from 'react';

const NmSkeleton: React.FC<{ width?: string | number; height?: string | number; radius?: number }> = ({
  width = '100%', height = 14, radius = 8,
}) => (
  <div
    style={{
      width, height, borderRadius: radius,
      background: 'var(--nm-surface)',
      boxShadow: 'var(--shadow-nm-inset-sm)',
      animation: 'nm-pulse 1.8s ease-in-out infinite',
    }}
    aria-hidden="true"
  />
);

export const SkeletonCard: React.FC<{ lines?: number }> = ({ lines = 3 }) => (
  <div
    className="nm"
    style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}
    aria-busy="true"
    aria-label="Loading case"
  >
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <NmSkeleton width={100} height={18} radius={10} />
      <NmSkeleton width={70} height={22} radius={11} />
    </div>
    {Array.from({ length: lines }).map((_, i) => (
      <NmSkeleton key={i} width={i % 2 === 0 ? '100%' : '70%'} />
    ))}
    <div style={{ display: 'flex', gap: 8 }}>
      <NmSkeleton width={52} height={22} radius={11} />
      <NmSkeleton width={68} height={22} radius={11} />
    </div>
  </div>
);

export const SkeletonDetailPanel: React.FC = () => (
  <div
    className="nm-lg"
    style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 16 }}
    aria-busy="true"
    aria-label="Loading details"
  >
    <NmSkeleton width={200} height={24} radius={12} />
    <NmSkeleton height={14} />
    <NmSkeleton width="85%" height={14} />
    <NmSkeleton width="65%" height={14} />
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 8 }}>
      <NmSkeleton height={64} radius={16} />
      <NmSkeleton height={64} radius={16} />
      <NmSkeleton height={64} radius={16} />
    </div>
  </div>
);

export { NmSkeleton as Skeleton };
