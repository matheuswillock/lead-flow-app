"use client";

import { motion, Variants } from "framer-motion";
import { cn } from "@/lib/utils";

interface PaperclipProps {
  className?: string;
  animateOnHover?: boolean;
}

const pathVariants: Variants = {
  normal: {
    pathLength: 1,
    opacity: 1,
    pathOffset: 0,
  },
  animate: {
    pathLength: [0, 1],
    opacity: [0, 1],
    pathOffset: [1, 0],
  },
};

export function Paperclip({ className, animateOnHover = false }: PaperclipProps) {
  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("lucide lucide-paperclip", className)}
      initial="normal"
      whileHover={animateOnHover ? "animate" : "normal"}
    >
      <motion.path
        d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"
        variants={pathVariants}
        transition={{
          duration: 0.4,
          ease: "easeInOut",
        }}
      />
    </motion.svg>
  );
}
