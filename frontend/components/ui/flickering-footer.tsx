"use client";

import { ChevronRightIcon } from "@radix-ui/react-icons";
import { ClassValue, clsx } from "clsx";
import * as Color from "color-bits";
import Link from "next/link";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const getRGBA = (
  cssColor: React.CSSProperties["color"],
  fallback: string = "rgba(180, 180, 180)",
): string => {
  if (typeof window === "undefined") return fallback;
  if (!cssColor) return fallback;

  try {
    if (typeof cssColor === "string" && cssColor.startsWith("var(")) {
      const element = document.createElement("div");
      element.style.color = cssColor;
      document.body.appendChild(element);
      const computedColor = window.getComputedStyle(element).color;
      document.body.removeChild(element);
      return Color.formatRGBA(Color.parse(computedColor));
    }
    return Color.formatRGBA(Color.parse(cssColor as string));
  } catch (e) {
    console.error("Color parsing failed:", e);
    return fallback;
  }
};

export const colorWithOpacity = (color: string, opacity: number): string => {
  if (!color.startsWith("rgb")) return color;
  return Color.formatRGBA(Color.alpha(Color.parse(color), opacity));
};

export const Icons = {
  logo: ({ className }: { className?: string }) => (
    <svg
      width="42"
      height="24"
      viewBox="0 0 42 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("size-4 fill-[var(--secondary)]", className)}
    >
      <g clipPath="url(#clip0_322_9172)">
        <path
          d="M22.3546 0.96832C22.9097 0.390834 23.6636 0.0664062 24.4487 0.0664062C27.9806 0.0664062 31.3091 0.066408 34.587 0.0664146C41.1797 0.0664284 44.481 8.35854 39.8193 13.2082L29.6649 23.7718C29.1987 24.2568 28.4016 23.9133 28.4016 23.2274V13.9234L29.5751 12.7025C30.5075 11.7326 29.8472 10.0742 28.5286 10.0742H13.6016L22.3546 0.96832Z"
          fill="current"
        />
        <path
          d="M19.6469 23.0305C19.0919 23.608 18.338 23.9324 17.5529 23.9324C14.021 23.9324 10.6925 23.9324 7.41462 23.9324C0.821896 23.9324 -2.47942 15.6403 2.18232 10.7906L12.3367 0.227022C12.8029 -0.257945 13.6 0.0855283 13.6 0.771372L13.6 10.0754L12.4265 11.2963C11.4941 12.2662 12.1544 13.9246 13.473 13.9246L28.4001 13.9246L19.6469 23.0305Z"
          fill="current"
        />
      </g>
      <defs>
        <clipPath id="clip0_322_9172">
          <rect width="42" height="24" fill="white" />
        </clipPath>
      </defs>
    </svg>
  ),
  soc2: ({ className }: { className?: string }) => (
    <svg width="46" height="45" viewBox="0 0 46 45" fill="none" className={cn("size-4", className)}>
      <rect x="3" y="0.863281" width="40" height="40" rx="20" fill="#222" />
    </svg>
  ),
  soc2Dark: ({ className }: { className?: string }) => (
    <svg width="46" height="45" viewBox="0 0 46 45" fill="none" className={cn("size-4", className)}>
      <rect x="3" y="0.863281" width="40" height="40" rx="20" fill="#333" />
    </svg>
  ),
  hipaa: ({ className }: { className?: string }) => (
    <svg width="46" height="45" viewBox="0 0 46 45" fill="none" className={cn("size-4", className)}>
      <rect x="3" y="0.863281" width="40" height="40" rx="20" fill="#222" />
    </svg>
  ),
  hipaaDark: ({ className }: { className?: string }) => (
    <svg width="46" height="45" viewBox="0 0 46 45" fill="none" className={cn("size-4", className)}>
      <rect x="3" y="0.863281" width="40" height="40" rx="20" fill="#333" />
    </svg>
  ),
  gdpr: ({ className }: { className?: string }) => (
    <svg width="46" height="45" viewBox="0 0 46 45" fill="none" className={cn("size-4", className)}>
      <rect x="3" y="0.863281" width="40" height="40" rx="20" fill="#222" />
    </svg>
  ),
  gdprDark: ({ className }: { className?: string }) => (
    <svg width="46" height="45" viewBox="0 0 46 45" fill="none" className={cn("size-4", className)}>
      <rect x="3" y="0.863281" width="40" height="40" rx="20" fill="#333" />
    </svg>
  ),
};

interface FlickeringGridProps extends React.HTMLAttributes<HTMLDivElement> {
  squareSize?: number;
  gridGap?: number;
  flickerChance?: number;
  color?: string;
  width?: number;
  height?: number;
  className?: string;
  maxOpacity?: number;
  text?: string;
  textColor?: string;
  fontSize?: number;
  fontWeight?: number | string;
}

export const FlickeringGrid: React.FC<FlickeringGridProps> = ({
  squareSize = 3,
  gridGap = 3,
  flickerChance = 0.2,
  color = "#B4B4B4",
  width,
  height,
  className,
  maxOpacity = 0.15,
  text = "",
  fontSize = 140,
  fontWeight = 600,
  ...props
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isInView, setIsInView] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  const memoizedColor = useMemo(() => getRGBA(color), [color]);

  const drawGrid = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      width: number,
      height: number,
      cols: number,
      rows: number,
      squares: Float32Array,
      dpr: number,
    ) => {
      ctx.clearRect(0, 0, width, height);

      const maskCanvas = document.createElement("canvas");
      maskCanvas.width = width;
      maskCanvas.height = height;
      const maskCtx = maskCanvas.getContext("2d", { willReadFrequently: true });
      if (!maskCtx) return;

      if (text) {
        maskCtx.save();
        maskCtx.scale(dpr, dpr);
        maskCtx.fillStyle = "white";
        maskCtx.font = `${fontWeight} ${fontSize}px "Geist", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
        maskCtx.textAlign = "center";
        maskCtx.textBaseline = "middle";
        maskCtx.fillText(text, width / (2 * dpr), height / (2 * dpr));
        maskCtx.restore();
      }

      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const x = i * (squareSize + gridGap) * dpr;
          const y = j * (squareSize + gridGap) * dpr;
          const squareWidth = squareSize * dpr;
          const squareHeight = squareSize * dpr;

          const maskData = maskCtx.getImageData(x, y, squareWidth, squareHeight).data;
          const hasText = maskData.some((value, index) => index % 4 === 0 && value > 0);

          const opacity = squares[i * rows + j];
          const finalOpacity = hasText ? Math.min(1, opacity * 3 + 0.4) : opacity;

          ctx.fillStyle = colorWithOpacity(memoizedColor, finalOpacity);
          ctx.fillRect(x, y, squareWidth, squareHeight);
        }
      }
    },
    [memoizedColor, squareSize, gridGap, text, fontSize, fontWeight],
  );

  const setupCanvas = useCallback(
    (canvas: HTMLCanvasElement, width: number, height: number) => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      const cols = Math.ceil(width / (squareSize + gridGap));
      const rows = Math.ceil(height / (squareSize + gridGap));

      const squares = new Float32Array(cols * rows);
      for (let i = 0; i < squares.length; i++) {
        squares[i] = Math.random() * maxOpacity;
      }

      return { cols, rows, squares, dpr };
    },
    [squareSize, gridGap, maxOpacity],
  );

  const updateSquares = useCallback(
    (squares: Float32Array, deltaTime: number) => {
      for (let i = 0; i < squares.length; i++) {
        if (Math.random() < flickerChance * deltaTime) {
          squares[i] = Math.random() * maxOpacity;
        }
      }
    },
    [flickerChance, maxOpacity],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let gridParams: ReturnType<typeof setupCanvas>;

    const updateCanvasSize = () => {
      const newWidth = width || container.clientWidth;
      const newHeight = height || container.clientHeight;
      setCanvasSize({ width: newWidth, height: newHeight });
      gridParams = setupCanvas(canvas, newWidth, newHeight);
    };

    updateCanvasSize();

    let lastTime = 0;
    const animate = (time: number) => {
      if (!isInView) return;

      const deltaTime = (time - lastTime) / 1000;
      lastTime = time;

      updateSquares(gridParams.squares, deltaTime);
      drawGrid(
        ctx,
        canvas.width,
        canvas.height,
        gridParams.cols,
        gridParams.rows,
        gridParams.squares,
        gridParams.dpr,
      );
      animationFrameId = requestAnimationFrame(animate);
    };

    const resizeObserver = new ResizeObserver(() => {
      updateCanvasSize();
    });

    resizeObserver.observe(container);

    const intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        setIsInView(entry.isIntersecting);
      },
      { threshold: 0 },
    );

    intersectionObserver.observe(canvas);

    if (isInView) {
      animationFrameId = requestAnimationFrame(animate);
    }

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
    };
  }, [setupCanvas, updateSquares, drawGrid, width, height, isInView]);

  return (
    <div ref={containerRef} className={cn(`h-full w-full ${className}`)} {...props}>
      <canvas
        ref={canvasRef}
        className="pointer-events-none"
        style={{
          width: canvasSize.width,
          height: canvasSize.height,
        }}
      />
    </div>
  );
};

export function useMediaQuery(query: string) {
  const [value, setValue] = useState(false);

  useEffect(() => {
    function checkQuery() {
      const result = window.matchMedia(query);
      setValue(result.matches);
    }
    checkQuery();
    window.addEventListener("resize", checkQuery);
    const mediaQuery = window.matchMedia(query);
    mediaQuery.addEventListener("change", checkQuery);
    return () => {
      window.removeEventListener("resize", checkQuery);
      mediaQuery.removeEventListener("change", checkQuery);
    };
  }, [query]);
  return value;
}

const siteConfig = {
  hero: {
    description:
      "Built to outlast, designed to perform. Conquer your fitness with no looking back.",
  },
  footerLinks: [
    {
      title: "Navigation",
      links: [
        { id: 1, title: "Activity", url: "/feature1" },
        { id: 2, title: "Squad Arena", url: "/feature2" },
      ],
    },
    {
      title: "Legals",
      links: [
        { id: 3, title: "Privacy Policy", url: "#" },
        { id: 4, title: "Terms of Service", url: "#" },
      ],
    },
    {
      title: "Social",
      links: [
        { id: 5, title: "Twitter", url: "#" },
        { id: 6, title: "Instagram", url: "#" },
      ],
    },
  ],
};

interface FooterProps {
  footerText?: string;
}

export const Component = ({ footerText = "Discipline over motivation." }: FooterProps) => {
  const tablet = useMediaQuery("(max-width: 1024px)");

  return (
    <footer id="footer" className="w-full pb-0 bg-black/50 border-t border-white/10 mt-20 relative overflow-hidden text-zinc-300">
      <div className="container mx-auto px-6 py-12 lg:py-16 md:flex md:justify-between items-start gap-12 z-10 relative">
        <div className="flex flex-col items-start justify-start gap-y-6 max-w-sm mb-12 md:mb-0">
          <Link href="/" className="flex items-center gap-3 group">
            <h2 className="font-mono text-2xl font-bold tracking-widest uppercase italic text-white drop-shadow-md group-hover:text-zinc-300 transition-colors">FitConquest</h2>
          </Link>
          <p className="text-zinc-400 font-medium leading-relaxed font-mono text-sm tracking-wide">
            {siteConfig.hero.description}
          </p>
        </div>
        
        <div className="flex flex-col md:flex-row gap-8 lg:gap-16">
          {siteConfig.footerLinks.map((column, columnIndex) => (
            <ul key={columnIndex} className="flex flex-col gap-y-4">
              <li className="mb-2 text-sm font-bold text-white tracking-widest uppercase font-mono border-b border-white/10 pb-2">
                {column.title}
              </li>
              {column.links.map((link) => (
                <li
                  key={link.id}
                  className="group inline-flex cursor-pointer items-center justify-start gap-2 text-sm text-zinc-400 font-medium hover:text-white transition-colors"
                >
                  <Link href={link.url} className="uppercase tracking-wider">{link.title}</Link>
                  <div className="flex size-4 items-center justify-center rounded transform opacity-0 -translate-x-2 transition-all duration-300 ease-out group-hover:translate-x-0 group-hover:opacity-100">
                    <ChevronRightIcon className="h-4 w-4 text-white" />
                  </div>
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>
      
      <div className="w-full h-48 md:h-72 relative mt-8 md:mt-16 z-0">
        <div className="absolute inset-0 bg-gradient-to-t from-transparent to-black z-10 from-60%" />
        <div className="absolute inset-x-0 bottom-0 top-0 mx-6">
          <FlickeringGrid
            text={tablet ? footerText.split(" ")[0] : footerText}
            fontSize={tablet ? 50 : 80}
            className="h-full w-full"
            squareSize={2}
            gridGap={tablet ? 2 : 3}
            color="#6B7280"
            maxOpacity={0.4}
            flickerChance={0.15}
            fontWeight={800}
          />
        </div>
      </div>
    </footer>
  );
};
