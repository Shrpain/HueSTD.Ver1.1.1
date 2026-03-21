import React from 'react';

interface SkeletonProps {
  count?: number;
  height?: number | string;
  width?: number | string;
  variant?: 'text' | 'circular' | 'rectangular';
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  count = 1,
  height = 16,
  width,
  variant = 'text',
  className = ''
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'circular':
        return {
          width: height,
          height: height,
          borderRadius: '50%'
        };
      case 'rectangular':
        return {
          width: width || '100%',
          height: height,
          borderRadius: '8px'
        };
      default:
        return {
          width: width || '100%',
          height: height,
          borderRadius: '4px'
        };
    }
  };

  const baseStyles = getVariantStyles();

  return (
    <>
      {[...Array(count)].map((_, index) => (
        <div
          key={index}
          className={`animate-pulse bg-slate-200 ${className}`}
          style={{
            ...baseStyles,
            animationDelay: `${index * 100}ms`
          }}
        />
      ))}
    </>
  );
};

interface SkeletonTableProps {
  rows?: number;
  columns?: number;
}

export const SkeletonTable: React.FC<SkeletonTableProps> = ({ rows = 5, columns = 5 }) => {
  return (
    <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
      <div className="p-4 border-b">
        <div className="flex gap-4">
          {[...Array(columns)].map((_, i) => (
            <Skeleton key={i} height={12} width={`${100 + i * 20}%`} />
          ))}
        </div>
      </div>
      <div className="divide-y">
        {[...Array(rows)].map((_, rowIndex) => (
          <div key={rowIndex} className="p-4 flex gap-4 items-center">
            {[...Array(columns)].map((_, colIndex) => (
              <Skeleton
                key={colIndex}
                height={colIndex === 0 ? 40 : 16}
                width={colIndex === 0 ? 40 : `${60 + colIndex * 10}%`}
                variant={colIndex === 0 ? 'circular' : 'text'}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Skeleton;
