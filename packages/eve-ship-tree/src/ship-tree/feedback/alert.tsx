import type { ReactNode } from 'react'

import { cx } from '../styles-api'
import classes from './alert.module.css'

export interface AlertProps {
  title: ReactNode
  children: ReactNode
  color: 'red' | 'yellow'
  classNames?: { root?: string; message?: string }
}

export const Alert = ({ title, children, color, classNames }: AlertProps) => (
  <div
    role="alert"
    className={cx(classes.root, classNames?.root)}
    data-color={color}
  >
    <div className={classes.title}>{title}</div>
    <div className={cx(classes.message, classNames?.message)}>{children}</div>
  </div>
)
