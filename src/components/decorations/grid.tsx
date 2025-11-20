import { cn } from "@/lib/utils"
import { useId } from "react"

export const Grid = ({
  pattern,
  size,
  className,
  gridFillClassName,
}: {
  pattern?: number[][]
  size?: number
  className?: string
  gridFillClassName?: string
}) => {
  const p = pattern ?? [
    [Math.floor(Math.random() * 4) + 7, Math.floor(Math.random() * 6) + 1],
    [Math.floor(Math.random() * 4) + 7, Math.floor(Math.random() * 6) + 1],
    [Math.floor(Math.random() * 4) + 7, Math.floor(Math.random() * 6) + 1],
    [Math.floor(Math.random() * 4) + 7, Math.floor(Math.random() * 6) + 1],
    [Math.floor(Math.random() * 4) + 7, Math.floor(Math.random() * 6) + 1],
  ]
  return (
    <div
      className={cn(
        "pointer-events-none absolute top-20 left-0 right-0 bottom-0 h-full w-full [mask-image:linear-gradient(white,white)] dark:[mask-image:linear-gradient(neutral-950,neutral-950)]",
        className
      )}
    >
      <div className='absolute inset-0 bg-gradient-to-b from-zinc-100/50 to-zinc-300/50 opacity-100 [mask-image:radial-gradient(farthest-side_at_top,white,transparent)] dark:from-neutral-950/50 dark:via-neutral-950/50 dark:to-neutral-950/50'>
        <GridPattern
          width={size ?? 20}
          height={size ?? 20}
          x='-12'
          y='4'
          squares={p}
          className={cn(
            "fill-zinc-500/50 stroke-zinc-500/50 dark:fill-neutral-500/50 dark:stroke-neutral-500/50 absolute inset-0 h-full w-full mix-blend-overlay",
            gridFillClassName
          )}
        />
      </div>
    </div>
  )
}
//eslint-disable-next-line @typescript-eslint/no-explicit-any
function GridPattern({ width, height, x, y, squares, ...props }: any) {
  const patternId = useId()
  return (
    <svg aria-hidden='true' {...props}>
      <defs>
        <pattern
          id={patternId}
          width={width}
          height={height}
          patternUnits='userSpaceOnUse'
          x={x}
          y={y}
        >
          <path d={`M.5 ${height}V.5H${width}`} fill='none' />
        </pattern>
      </defs>
      <rect width='100%' height='100%' strokeWidth={0} fill={`url(#${patternId})`} />
      {squares && (
        <svg x={x} y={y} className='overflow-visible'>
          {/* eslint-disable-next-line @typescript-eslint/no-unsafe-member-access */}
          {squares.map(([x, y]: [number, number], i: number) => (
            <rect
              strokeWidth='0'
              key={`${x}-${y}-${i}`}
              width={Number(width) + 1}
              height={Number(height) + 1}
              x={x * width}
              y={y * height}
            />
          ))}
        </svg>
      )}
    </svg>
  )
}
