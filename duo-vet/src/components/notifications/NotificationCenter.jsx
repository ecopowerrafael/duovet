import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import NotificationPanel from './NotificationPanel';

export default function NotificationCenter({ isOpen, onClose }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm md:bg-black/40"
          />
          <motion.div
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed top-0 bottom-0 right-0 z-[110] w-full md:w-auto"
          >
            <NotificationPanel isOpen={isOpen} onClose={onClose} />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}