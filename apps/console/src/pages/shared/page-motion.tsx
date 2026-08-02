import { motion, type MotionProps } from "framer-motion";
import { usePreferencesStore } from "@/stores/preferences-store";
import { cn } from "@/lib/utils";

export function PageMotion({
  children,
  className,
  ...props
}: MotionProps & { children: React.ReactNode; className?: string }) {
  const reducedMotion = usePreferencesStore((s) => s.reducedMotion);

  if (reducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className={cn(className)}
      {...props}
    >
      {children}
    </motion.div>
  );
}
