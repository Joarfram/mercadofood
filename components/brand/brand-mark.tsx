type BrandMarkProps = {
  size?: number;
  className?: string;
  title?: string;
};

export function BrandMark({ size = 48, className = "", title = "MercadoFood" }: BrandMarkProps) {
  return <svg
    width={size}
    height={size}
    viewBox="0 0 96 96"
    role="img"
    aria-label={title}
    className={className}
  >
    <title>{title}</title>
    <path d="M31 27v-5C31 10 38 4 48 4s17 6 17 18v5" fill="none" stroke="#22C55E" strokeWidth="7" strokeLinecap="round"/>
    <path d="M20 25h56l6 55c.7 7-3.5 12-10 12H24c-6.5 0-10.7-5-10-12l6-55Z" fill="#22C55E"/>
    <path d="M18 55H5M17 65H1M20 75H8" fill="none" stroke="#15803D" strokeWidth="6" strokeLinecap="round"/>
    <circle cx="49" cy="59" r="25" fill="#FFFFFF"/>
    <circle cx="49" cy="59" r="20" fill="none" stroke="#15803D" strokeWidth="4"/>
    <path d="M39 43v14M34 43v14M44 43v14M34 50h10M39 57v18" fill="none" stroke="#F97316" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M59 43v32M59 43c8 4 8 15 0 19" fill="none" stroke="#F97316" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>;
}
