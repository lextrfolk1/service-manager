import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { ClickAwayListener, Grow, ListItemText, MenuItem, MenuList, Paper, Popper, Typography } from "@mui/material";
import { ChevronLeftRounded as ChevronLeftIcon, ChevronRightRounded as ChevronRightIcon } from "@mui/icons-material";

// A menu row that shows only the current choice ("Theme · Warm") and opens a side panel with the
// options on hover, click, or arrow keys / Enter. The panel opens on whichever side has room,
// and the arrow on the row always points to that side.
export default function HoverSubmenu({ label, value, children, width = 240 }) {
  const anchorRef = useRef(null);
  const closeTimer = useRef(null);
  const [open, setOpen] = useState(false);
  const [side, setSide] = useState("left");

  const measureSide = useCallback(() => {
    const rect = anchorRef.current?.getBoundingClientRect();
    if (!rect) return;
    const roomLeft = rect.left;
    const roomRight = window.innerWidth - rect.right;
    setSide(roomLeft >= width + 12 || roomLeft >= roomRight ? "left" : "right");
  }, [width]);

  useLayoutEffect(() => {
    measureSide();
    window.addEventListener("resize", measureSide);
    return () => window.removeEventListener("resize", measureSide);
  }, [measureSide]);

  const show = () => {
    clearTimeout(closeTimer.current);
    measureSide();
    setOpen(true);
  };
  const hideSoon = () => {
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), 150);
  };

  return (
    <>
      <MenuItem
        ref={anchorRef}
        aria-haspopup="menu"
        aria-expanded={open}
        onMouseEnter={show}
        onMouseLeave={hideSoon}
        onClick={() => {
          measureSide();
          setOpen((previous) => !previous);
        }}
        onKeyDown={(event) => {
          const opensWith = side === "left" ? "ArrowLeft" : "ArrowRight";
          if (event.key === opensWith || event.key === "Enter") {
            event.preventDefault();
            measureSide();
            setOpen(true);
          }
        }}
        selected={open}
        sx={{ py: 0.6 }}
      >
        {side === "left" ? <ChevronLeftIcon sx={{ fontSize: 18, color: "text.secondary", mr: 0.5, ml: -0.5 }} /> : null}
        <ListItemText primary={label} primaryTypographyProps={{ fontSize: "0.85rem" }} />
        <Typography sx={{ fontSize: "0.82rem", fontWeight: 700, color: "text.secondary", ml: 2 }}>{value}</Typography>
        {side === "right" ? <ChevronRightIcon sx={{ fontSize: 18, color: "text.secondary", ml: 0.5, mr: -0.5 }} /> : null}
      </MenuItem>
      <Popper
        open={open}
        anchorEl={anchorRef.current}
        placement={side === "left" ? "left-start" : "right-start"}
        transition
        sx={{ zIndex: (theme) => theme.zIndex.modal + 1 }}
        modifiers={[
          { name: "offset", options: { offset: [-6, 4] } },
          { name: "flip", enabled: false }, // the side is chosen above, so the arrow always matches
          { name: "preventOverflow", options: { padding: 8 } },
        ]}
      >
        {({ TransitionProps }) => (
          <Grow {...TransitionProps} style={{ transformOrigin: side === "left" ? "right top" : "left top" }}>
            <Paper
              elevation={8}
              onMouseEnter={show}
              onMouseLeave={hideSoon}
              sx={{ width, borderRadius: 2, py: 0.5 }}
            >
              <ClickAwayListener onClickAway={(event) => !anchorRef.current?.contains(event.target) && setOpen(false)}>
                <MenuList
                  autoFocusItem={open}
                  dense
                  onKeyDown={(event) => {
                    const closesWith = side === "left" ? "ArrowRight" : "ArrowLeft";
                    if (event.key === closesWith || event.key === "Escape") {
                      event.stopPropagation();
                      setOpen(false);
                      anchorRef.current?.focus();
                    }
                  }}
                >
                  {typeof children === "function" ? children(() => setOpen(false)) : children}
                </MenuList>
              </ClickAwayListener>
            </Paper>
          </Grow>
        )}
      </Popper>
    </>
  );
}
