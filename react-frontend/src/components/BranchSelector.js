import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Alert,
  Box,
  CircularProgress,
  Divider,
  FormControlLabel,
  IconButton,
  InputAdornment,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Popover,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  CallSplit as CallSplitIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  CloudQueue as CloudIcon,
  Computer as ComputerIcon,
  KeyboardArrowDown as KeyboardArrowDownIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
} from "@mui/icons-material";
import api from "../services/api";

function BranchSelector({
  serviceName,
  gitInfo,
  isRunning = false,
  isBusy = false,
  onBranchCheckout,
  fullWidth = true,
}) {
  const [anchorEl, setAnchorEl] = useState(null);
  const [branchData, setBranchData] = useState(null);
  const [optimisticBranch, setOptimisticBranch] = useState(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [restartOnSwitch, setRestartOnSwitch] = useState(isRunning);
  const [error, setError] = useState("");

  const isOpen = Boolean(anchorEl);

  // Reset optimistic branch when gitInfo prop catches up
  useEffect(() => {
    if (gitInfo?.currentBranch && optimisticBranch === gitInfo.currentBranch) {
      setOptimisticBranch(null);
    }
  }, [gitInfo?.currentBranch, optimisticBranch]);

  const fetchBranches = useCallback(async (fetchRemote = false) => {
    try {
      setLoading(true);
      setError("");
      const data = await api.get(`/service/${serviceName}/git/branches${fetchRemote ? "?fetch=true" : ""}`);
      setBranchData(data);
    } catch (err) {
      setError(err.message || "Failed to load branches");
    } finally {
      setLoading(false);
    }
  }, [serviceName]);

  useEffect(() => {
    if (isOpen) {
      setRestartOnSwitch(isRunning);
      fetchBranches();
    } else {
      setSearch("");
      setError("");
    }
  }, [isOpen, isRunning, fetchBranches]);

  function handleOpen(event) {
    if (isBusy) return;
    setAnchorEl(event.currentTarget);
  }

  function handleClose() {
    setAnchorEl(null);
    setBranchData(null);
    setSearch("");
    setError("");
  }

  async function handleSelectBranch(branch) {
    const currentActive = optimisticBranch || gitInfo?.currentBranch || branchData?.currentBranch;
    if (branch === currentActive) {
      handleClose();
      return;
    }

    // Immediately update UI optimistically and close the popover
    setOptimisticBranch(branch);
    handleClose();

    try {
      if (onBranchCheckout) {
        await onBranchCheckout(serviceName, branch, restartOnSwitch);
      } else {
        await api.post(`/service/${serviceName}/git/checkout`, {
          branch,
          restart: restartOnSwitch,
        });
      }
    } catch (err) {
      // Revert optimistic branch if checkout failed
      setOptimisticBranch(null);
    }
  }

  const currentBranch = optimisticBranch || gitInfo?.currentBranch || branchData?.currentBranch || "detached";
  const isDirty = branchData?.isDirty ?? gitInfo?.isDirty ?? false;
  const uncommittedCount = branchData?.uncommittedCount ?? gitInfo?.uncommittedCount ?? 0;

  const normalizedSearch = search.trim().toLowerCase();

  const filteredLocalBranches = useMemo(() => {
    if (!branchData?.localBranches) return [];
    return branchData.localBranches.filter((b) =>
      b.toLowerCase().includes(normalizedSearch)
    );
  }, [branchData?.localBranches, normalizedSearch]);

  const filteredRemoteBranches = useMemo(() => {
    if (!branchData?.remoteBranches) return [];
    // Filter out remotes that have a direct local match with same name
    return branchData.remoteBranches.filter((b) => {
      const shortName = b.replace(/^origin\//, "");
      const matchesSearch = b.toLowerCase().includes(normalizedSearch);
      const isAlreadyLocal = branchData.localBranches?.includes(shortName);
      return matchesSearch && !isAlreadyLocal;
    });
  }, [branchData?.remoteBranches, branchData?.localBranches, normalizedSearch]);

  if (!gitInfo?.isGitRepo) {
    return null;
  }

  return (
    <>
      <Tooltip
        title={
          isDirty
            ? `Git: ${currentBranch} (${uncommittedCount} uncommitted changes) - Click to switch`
            : `Git: ${currentBranch} - Click to switch branch`
        }
      >
        <Box
          component="button"
          type="button"
          onClick={isBusy ? undefined : handleOpen}
          disabled={isBusy}
          sx={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 0.5,
            width: fullWidth ? "100%" : "auto",
            maxWidth: "100%",
            height: 24,
            px: 0.75,
            py: 0,
            borderRadius: 1.5,
            fontSize: "0.72rem",
            fontWeight: 600,
            cursor: isBusy ? "default" : "pointer",
            color: isDirty ? "warning.dark" : "text.secondary",
            backgroundColor: isDirty ? "rgba(237, 108, 2, 0.08)" : "rgba(15, 23, 42, 0.04)",
            border: "1px solid",
            borderColor: isDirty ? "warning.light" : "rgba(148, 163, 184, 0.25)",
            outline: "none",
            transition: "all 0.15s ease",
            "&:hover": {
              backgroundColor: isBusy ? undefined : isDirty ? "rgba(237, 108, 2, 0.14)" : "rgba(15, 23, 42, 0.08)",
              borderColor: isBusy ? undefined : "primary.main",
              color: isBusy ? undefined : "text.primary",
            },
            "&:focus-visible": {
              borderColor: "primary.main",
              boxShadow: "0 0 0 2px rgba(25, 118, 210, 0.2)",
            },
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, minWidth: 0, flex: 1 }}>
            <CallSplitIcon sx={{ fontSize: "14px !important", flexShrink: 0, opacity: 0.75 }} />
            <Typography
              component="span"
              sx={{
                fontSize: "0.72rem",
                fontWeight: 600,
                color: "inherit",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                lineHeight: 1,
              }}
            >
              {currentBranch}
            </Typography>
            {isDirty && (
              <Box
                component="span"
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: 14,
                  height: 14,
                  px: 0.35,
                  borderRadius: "999px",
                  bgcolor: "warning.main",
                  color: "#fff",
                  fontSize: "0.6rem",
                  fontWeight: 700,
                  lineHeight: 1,
                  flexShrink: 0,
                }}
              >
                {uncommittedCount > 0 ? `+${uncommittedCount}` : "●"}
              </Box>
            )}
          </Box>
          <KeyboardArrowDownIcon sx={{ fontSize: "14px !important", flexShrink: 0, opacity: 0.45 }} />
        </Box>
      </Tooltip>

      <Popover
        open={isOpen}
        anchorEl={anchorEl}
        onClose={handleClose}
        disableRestoreFocus
        anchorOrigin={{
          vertical: "top",
          horizontal: "left",
        }}
        transformOrigin={{
          vertical: "bottom",
          horizontal: "left",
        }}
        PaperProps={{
          sx: {
            width: 320,
            maxHeight: 400,
            p: 1.5,
            borderRadius: 2.5,
            boxShadow: "0 10px 30px rgba(15,23,42,0.18)",
            display: "flex",
            flexDirection: "column",
          },
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}>
            <CallSplitIcon color="primary" fontSize="small" />
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }} noWrap>
              Switch Branch
            </Typography>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <Tooltip title="Fetch latest branches from remote">
              <span>
                <IconButton size="small" onClick={() => fetchBranches(true)} disabled={loading}>
                  <RefreshIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <IconButton size="small" onClick={handleClose}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>

        <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: "block" }}>
          Current: <strong>{currentBranch}</strong>
        </Typography>

        {isDirty && (
          <Alert severity="warning" sx={{ mb: 1, py: 0.25, px: 1, fontSize: "0.75rem", borderRadius: 1.5 }}>
            Working directory has {uncommittedCount} uncommitted change(s).
          </Alert>
        )}

        <TextField
          size="small"
          placeholder="Filter branches..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
          fullWidth
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" sx={{ color: "text.secondary" }} />
              </InputAdornment>
            ),
          }}
          sx={{ mb: 1 }}
        />

        {isRunning && (
          <Box sx={{ mb: 1, px: 0.5 }}>
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={restartOnSwitch}
                  onChange={(e) => setRestartOnSwitch(e.target.checked)}
                  color="primary"
                />
              }
              label={
                <Typography variant="caption" color="text.secondary">
                  Restart service after checkout
                </Typography>
              }
              sx={{ m: 0 }}
            />
          </Box>
        )}

        <Divider sx={{ mb: 1 }} />

        {error && (
          <Alert severity="error" sx={{ mb: 1, py: 0.5, fontSize: "0.75rem", borderRadius: 1.5 }}>
            {error}
          </Alert>
        )}

        <Box sx={{ overflowY: "auto", flex: 1, maxHeight: 250 }}>
          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", py: 4 }}>
              <CircularProgress size={24} />
            </Box>
          ) : (
            <List dense disablePadding>
              {filteredLocalBranches.length > 0 && (
                <>
                  <ListSubheader
                    disableSticky
                    sx={{
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      lineHeight: "24px",
                      bgcolor: "transparent",
                      color: "text.secondary",
                      px: 1,
                    }}
                  >
                    LOCAL BRANCHES ({filteredLocalBranches.length})
                  </ListSubheader>
                  {filteredLocalBranches.map((branch) => {
                    const isCurrent = branch === currentBranch;

                    return (
                      <ListItemButton
                        key={branch}
                        onClick={() => handleSelectBranch(branch)}
                        selected={isCurrent}
                        sx={{
                          py: 0.5,
                          px: 1,
                          borderRadius: 1.5,
                          mb: 0.25,
                        }}
                      >
                        <ListItemIcon sx={{ minWidth: 26 }}>
                          {isCurrent ? (
                            <CheckIcon fontSize="small" color="primary" />
                          ) : (
                            <ComputerIcon fontSize="small" sx={{ color: "text.disabled", fontSize: 16 }} />
                          )}
                        </ListItemIcon>
                        <ListItemText
                          primary={branch}
                          primaryTypographyProps={{
                            variant: "body2",
                            fontSize: "0.78rem",
                            fontWeight: isCurrent ? 700 : 400,
                            color: isCurrent ? "primary.main" : "text.primary",
                            noWrap: true,
                          }}
                        />
                      </ListItemButton>
                    );
                  })}
                </>
              )}

              {filteredRemoteBranches.length > 0 && (
                <>
                  <ListSubheader
                    disableSticky
                    sx={{
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      lineHeight: "24px",
                      bgcolor: "transparent",
                      color: "text.secondary",
                      px: 1,
                      mt: filteredLocalBranches.length > 0 ? 1 : 0,
                    }}
                  >
                    REMOTE BRANCHES ({filteredRemoteBranches.length})
                  </ListSubheader>
                  {filteredRemoteBranches.map((branch) => {
                    return (
                      <ListItemButton
                        key={branch}
                        onClick={() => handleSelectBranch(branch)}
                        sx={{
                          py: 0.5,
                          px: 1,
                          borderRadius: 1.5,
                          mb: 0.25,
                        }}
                      >
                        <ListItemIcon sx={{ minWidth: 26 }}>
                          <CloudIcon fontSize="small" sx={{ color: "text.disabled", fontSize: 16 }} />
                        </ListItemIcon>
                        <ListItemText
                          primary={branch}
                          primaryTypographyProps={{
                            variant: "body2",
                            fontSize: "0.78rem",
                            color: "text.secondary",
                            noWrap: true,
                          }}
                        />
                      </ListItemButton>
                    );
                  })}
                </>
              )}

              {filteredLocalBranches.length === 0 && filteredRemoteBranches.length === 0 && (
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", textAlign: "center", py: 2 }}>
                  No branches found matching "{search}"
                </Typography>
              )}
            </List>
          )}
        </Box>
      </Popover>
    </>
  );
}

export default BranchSelector;
