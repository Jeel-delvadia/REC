import React from 'react';
import { motion } from 'framer-motion';

/** The one surface component - every panel in the app is a Card so radius/border/shadow never drift page to page. */
export default function Card({ interactive = false, padding = 'p-5', className = '', children, animate = true, ...rest }) {
  const classes = `card ${interactive ? 'card-interactive' : ''} ${padding} ${className}`;
  if (!animate) {
    return <div className={classes} {...rest}>{children}</div>;
  }
  return (
    <motion.div
      className={classes}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
