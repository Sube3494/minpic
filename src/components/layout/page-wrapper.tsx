'use client';

import { motion } from 'framer-motion';

export function PageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ 
        duration: 0.2, 
        ease: "linear",
      }}
      className="w-full"
    >
      {children}
    </motion.div>
  );
}
