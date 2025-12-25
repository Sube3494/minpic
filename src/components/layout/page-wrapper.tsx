'use client';

import { motion } from 'framer-motion';

export function PageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ 
        duration: 0.4, 
        ease: "easeOut",
      }}
      style={{ willChange: 'opacity, transform' }}
      className="w-full flex-1 flex flex-col"
    >
      {children}
    </motion.div>
  );
}
