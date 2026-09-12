import React from 'react';
import { Link } from 'react-router-dom';

const VARIANTS = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
};

const SIZES = {
  sm: 'px-2.5 py-1.5 text-xs',
  md: 'px-3.5 py-2 text-sm',
  lg: 'px-4 py-2.5 text-sm',
};

/**
 * Shared button - one component for every primary/secondary/ghost/danger action in the app,
 * so button treatment is decided in one place (index.css's .btn-*) instead of per-page Tailwind
 * strings drifting apart page by page. Renders as a react-router <Link> when `to` is given.
 */
export default function Button({
  variant = 'secondary',
  size = 'md',
  to,
  icon: Icon,
  iconRight: IconRight,
  className = '',
  children,
  ...rest
}) {
  const classes = `btn ${VARIANTS[variant] || VARIANTS.secondary} ${SIZES[size] || SIZES.md} ${className}`;
  const content = (
    <>
      {Icon && <Icon className="w-4 h-4 shrink-0" />}
      {children && <span>{children}</span>}
      {IconRight && <IconRight className="w-4 h-4 shrink-0" />}
    </>
  );
  if (to) {
    return (
      <Link to={to} className={classes} {...rest}>
        {content}
      </Link>
    );
  }
  return (
    <button className={classes} {...rest}>
      {content}
    </button>
  );
}
