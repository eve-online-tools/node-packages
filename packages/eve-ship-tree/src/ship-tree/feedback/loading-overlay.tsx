import classes from './loading-overlay.module.css'

export const LoadingOverlay = () => (
  <div
    className={classes.root}
    role="status"
    aria-label="Loading"
    data-testid="ship-tree-loading"
  >
    <span className={classes.dot} />
    <span className={classes.dot} />
    <span className={classes.dot} />
  </div>
)
