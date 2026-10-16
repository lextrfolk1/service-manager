import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
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
  Stack,
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
  CloudDownloadRounded as CloudDownloadIcon,
  CloudOffRounded as CloudOffIcon,
  CloudUploadRounded as CloudUploadIcon,
  Computer as ComputerIcon,
  EditRounded as EditIcon,
  KeyboardArrowDown as KeyboardArrowDownIcon,
  SyncRounded as SyncIcon,
  Search as SearchIcon,
  WarningAmberRounded as WarningAmberIcon,
} from "@mui/icons-material";
import api from "../services/api";

function BranchSelector({
  serviceName,
  gitInfo,
  isRunning = false,
  isBusy = false,
  onBranchCheckout,
  onGitPull,
  onGitPush,
  fullWidth = true,
}) {
  const [anchorEl, setAnchorEl] = useState(null);
  const [branchData, setBranchData] = useState(null);
  const [optimisticBranch, setOptimisticBranch] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [pushing, setPushing] = useState(false);
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

  async function handlePush(event) {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    if (isBusy || pushing) return;

    try {
      setPushing(true);
      setError("");
      if (onGitPush) {
        await onGitPush(serviceName);
      } else {
        await api.post(`/service/${serviceName}/git/push`, {});
      }
      if (isOpen) {
        await fetchBranches();
      }
    } catch (err) {
      const msg = err.details || err.message || err.error || "Git push failed";
      setError(msg);
    } finally {
      setPushing(false);
    }
  }

  async function handlePull(event, restart = false) {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    if (isBusy || pulling) return;

    try {
      setPulling(true);
      setError("");
      if (onGitPull) {
        await onGitPull(serviceName, restart);
      } else {
        await api.post(`/service/${serviceName}/git/pull`, {
          restart,
        });
      }
      if (isOpen) {
        await fetchBranches();
      }
    } catch (err) {
      const msg = err.details || err.message || err.error || "Git pull failed";
      setError(msg);
    } finally {
      setPulling(false);
    }
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
  const ahead = branchData?.ahead ?? gitInfo?.ahead ?? 0;
  const behind = branchData?.behind ?? gitInfo?.behind ?? 0;
  const hasUpstream = branchData?.hasUpstream ?? gitInfo?.hasUpstream ?? false;
  const upstreamBranch = branchData?.upstreamBranch ?? gitInfo?.upstreamBranch ?? null;

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

  const branchTooltip = [
    `Branch: ${currentBranch}`,
    !hasUpstream ? "Local branch: not pushed to remote (git pull is skipped on start)" : "",
    behind > 0 ? `${behind} commit(s) behind ${upstreamBranch || "origin"}` : "",
    ahead > 0 ? `${ahead} commit(s) ahead of ${upstreamBranch || "origin"}` : "",
    isDirty ? `${uncommittedCount} uncommitted change(s)` : "",
    "Click to switch branch",
  ]
    .filter(Boolean)
    .join(" • ");

  const isLocalOnly = !hasUpstream;
  const nothingToPush = hasUpstream && ahead === 0;
  const pushTooltip = pushing
    ? `Pushing ${currentBranch} to remote...`
    : nothingToPush
    ? "Nothing to push"
    : isLocalOnly
    ? `Git Push: Publish local branch ${currentBranch} to remote (sets upstream)`
    : `Git Push: ${ahead} commit(s) to ${upstreamBranch || "remote"}`;

  const pullTooltip = pulling
    ? `Pulling latest changes for ${serviceName}...`
    : behind > 0
    ? `Git Pull: ${behind} new commit(s) available from ${upstreamBranch || "remote"}`
    : `Git Pull: Fetch & merge latest commits for ${currentBranch}`;
  const railPullTooltip = pulling ? pullTooltip : `${pullTooltip} (service is not restarted)`;

  const changeSummary = [
    isDirty ? `${uncommittedCount || "Some"} uncommitted change(s)` : "",
    behind > 0 ? `${behind} commit(s) behind ${upstreamBranch || "origin"}` : "",
    ahead > 0 ? `${ahead} commit(s) ahead of ${upstreamBranch || "origin"}` : "",
    isLocalOnly ? "Local branch: not pushed to remote" : "",
  ]
    .filter(Boolean)
    .join(" • ");

  return (
    <>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 0.5,
          width: fullWidth ? "100%" : "auto",
          minWidth: 0,
          py: 0.25,
          px: 0.6,
          borderRadius: "6px",
          bgcolor: "rgba(15, 23, 42, 0.025)",
          border: "1px solid rgba(148, 163, 184, 0.16)",
          transition: "all 0.15s ease",
          "&:hover": {
            bgcolor: "rgba(15, 23, 42, 0.045)",
            borderColor: "rgba(148, 163, 184, 0.3)",
          },
        }}
      >
        {/* Left Side: [Git icon] [Branch name ▼] [Change indicators] */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.5,
            minWidth: 0,
            flex: "1 1 auto",
            overflow: "hidden",
          }}
        >
          {/* [Git icon] + [Branch name ▼] */}
          <Tooltip title={branchTooltip} placement="top" arrow disableInteractive>
            <Box
              component="button"
              type="button"
              onClick={isBusy ? undefined : handleOpen}
              disabled={isBusy}
              aria-label={`Current branch: ${currentBranch}. Click to switch branch.`}
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 0.4,
                minWidth: 0,
                flex: "1 1 auto",
                p: 0,
                border: "none",
                bgcolor: "transparent",
                cursor: isBusy ? "default" : "pointer",
                color: "#101828",
                outline: "none",
                borderRadius: "4px",
                "&:hover": {
                  color: "primary.main",
                },
                "&:focus-visible": {
                  boxShadow: "0 0 0 2px rgba(25, 118, 210, 0.3)",
                },
              }}
            >
              <CallSplitIcon sx={{ fontSize: "15px !important", flexShrink: 0, color: "#64748b" }} />
              <Typography
                component="span"
                sx={{
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  color: "inherit",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  lineHeight: 1.2,
                  minWidth: 0,
                }}
              >
                {currentBranch}
              </Typography>
              <KeyboardArrowDownIcon sx={{ fontSize: "14px !important", flexShrink: 0, color: "#94a3b8" }} />
            </Box>
          </Tooltip>

          {/* [Change indicators] — one compact cluster: ✎modified ↓behind ↑ahead, not-pushed icon */}
          {changeSummary ? (
            <Tooltip title={changeSummary} placement="top" arrow disableInteractive>
              <Box
                component="span"
                aria-label={changeSummary}
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 0.5,
                  flexShrink: 0,
                  fontSize: "0.68rem",
                  fontWeight: 700,
                  lineHeight: 1,
                  whiteSpace: "nowrap",
                }}
              >
                {isDirty ? (
                  <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.2, color: "#475569" }}>
                    <EditIcon sx={{ fontSize: "11px !important" }} />
                    {uncommittedCount || ""}
                  </Box>
                ) : null}
                {behind > 0 ? (
                  <Box component="span" sx={{ color: "#0284c7" }}>
                    ↓{behind}
                  </Box>
                ) : null}
                {ahead > 0 ? (
                  <Box component="span" sx={{ color: "#4f46e5" }}>
                    ↑{ahead}
                  </Box>
                ) : null}
                {isLocalOnly ? <CloudOffIcon sx={{ fontSize: "12px !important", color: "#4f46e5" }} /> : null}
              </Box>
            </Tooltip>
          ) : null}
        </Box>

        {/* Right Side: [Pull] [Push] — hidden while the service is busy (nothing can run) */}
        {!isBusy ? (
          <Stack direction="row" spacing={0.25} alignItems="center" sx={{ flexShrink: 0 }}>
            {/* [Pull] button */}
            <Tooltip title={isLocalOnly ? "Git pull unavailable (local branch not pushed to remote)" : railPullTooltip} placement="top" arrow disableInteractive>
              <span>
                <IconButton
                  size="small"
                  type="button"
                  onClick={(e) => handlePull(e, false)}
                  disabled={isBusy || pulling || isLocalOnly}
                  aria-label={`Git pull for ${serviceName}`}
                  sx={{
                    width: 24,
                    height: 24,
                    p: 0,
                    borderRadius: "4px",
                    color: behind > 0 ? "#0284c7" : "#64748b",
                    bgcolor: behind > 0 ? "rgba(2, 132, 199, 0.1)" : "transparent",
                    transition: "all 0.15s ease",
                    "&:hover": {
                      bgcolor: "rgba(15, 23, 42, 0.08)",
                      color: behind > 0 ? "#0284c7" : "#0f172a",
                    },
                    "&:disabled": {
                      opacity: 0.45,
                      cursor: "not-allowed",
                    },
                  }}
                >
                  {pulling ? (
                    <CircularProgress size={12} color="inherit" />
                  ) : (
                    <CloudDownloadIcon sx={{ fontSize: "14px !important" }} />
                  )}
                </IconButton>
              </span>
            </Tooltip>

            {/* [Push] button */}
            <Tooltip title={pushTooltip} placement="top" arrow disableInteractive>
              <span>
                <IconButton
                  size="small"
                  type="button"
                  onClick={handlePush}
                  disabled={isBusy || pushing || nothingToPush}
                  aria-label={`Git push for ${serviceName}`}
                  sx={{
                    width: 24,
                    height: 24,
                    p: 0,
                    borderRadius: "4px",
                    color: ahead > 0 || isLocalOnly ? "#4f46e5" : "#64748b",
                    bgcolor: ahead > 0 || isLocalOnly ? "rgba(99, 102, 241, 0.1)" : "transparent",
                    transition: "all 0.15s ease",
                    "&:hover": {
                      bgcolor: "rgba(15, 23, 42, 0.08)",
                      color: ahead > 0 || isLocalOnly ? "#4f46e5" : "#0f172a",
                    },
                    "&:disabled": {
                      opacity: 0.45,
                      cursor: "not-allowed",
                    },
                  }}
                >
                  {pushing ? (
                    <CircularProgress size={12} sx={{ color: "#4f46e5" }} />
                  ) : (
                    <CloudUploadIcon sx={{ fontSize: "14px !important" }} />
                  )}
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        ) : null}
      </Box>

      {/* Popover */}
      <Popover
        open={isOpen}
        anchorEl={anchorEl}
        onClose={handleClose}
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
            width: 330,
            maxHeight: 440,
            p: 1.5,
            borderRadius: 2.5,
            boxShadow: "0 10px 30px rgba(15,23,42,0.18)",
            display: "flex",
            flexDirection: "column",
          },
        }}
      >
        {/* Header */}
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}>
            <CallSplitIcon color="primary" fontSize="small" />
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }} noWrap>
              Git Status & Branches
            </Typography>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <Tooltip title="Fetch latest branches & status from remote">
              <span>
                <IconButton size="small" onClick={() => fetchBranches(true)} disabled={loading || pulling}>
                  <SyncIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <IconButton size="small" onClick={handleClose}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>

        {/* Current Branch Status Box with direct Pull button */}
        <Box
          sx={{
            p: 1,
            mb: 1,
            borderRadius: 1.5,
            bgcolor: "rgba(15, 23, 42, 0.03)",
            border: "1px solid rgba(148, 163, 184, 0.18)",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", fontSize: "0.68rem" }}>
                CURRENT BRANCH
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700, fontSize: "0.82rem" }} noWrap>
                {currentBranch}
              </Typography>
            </Box>

            <Button
              size="small"
              variant={behind > 0 ? "contained" : "outlined"}
              onClick={(e) => handlePull(e, restartOnSwitch)}
              disabled={pulling || isBusy || isLocalOnly}
              startIcon={
                pulling ? (
                  <CircularProgress size={12} color="inherit" />
                ) : (
                  <CloudDownloadIcon sx={{ fontSize: "15px !important" }} />
                )
              }
              sx={{
                fontSize: "0.72rem",
                py: 0.25,
                px: 1,
                height: 26,
                textTransform: "none",
                fontWeight: 600,
                borderRadius: 1.5,
                flexShrink: 0,
              }}
            >
              {pulling ? "Pulling..." : behind > 0 ? `Pull (${behind})` : "Git Pull"}
            </Button>
          </Box>

          {/* Badges row inside popover */}
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 0.75, alignItems: "center" }}>
            {behind > 0 ? (
              <Chip
                size="small"
                label={`↓ ${behind} commit${behind > 1 ? "s" : ""} behind`}
                sx={{
                  height: 18,
                  fontSize: "0.65rem",
                  fontWeight: 600,
                  bgcolor: "rgba(2, 132, 199, 0.12)",
                  color: "#0284c7",
                  border: "1px solid rgba(2, 132, 199, 0.25)",
                }}
              />
            ) : null}

            {ahead > 0 ? (
              <Chip
                size="small"
                label={`↑ ${ahead} commit${ahead > 1 ? "s" : ""} ahead`}
                sx={{
                  height: 18,
                  fontSize: "0.65rem",
                  fontWeight: 600,
                  bgcolor: "rgba(99, 102, 241, 0.12)",
                  color: "#4f46e5",
                  border: "1px solid rgba(99, 102, 241, 0.25)",
                }}
              />
            ) : null}

            {behind === 0 && ahead === 0 && hasUpstream ? (
              <Chip
                size="small"
                label="Up to date"
                sx={{
                  fontSize: "0.65rem",
                  fontWeight: 600,
                  bgcolor: "rgba(34, 197, 94, 0.1)",
                  color: "#166534",
                  border: "1px solid rgba(34, 197, 94, 0.25)",
                }}
              />
            ) : null}

            {!hasUpstream ? (
              <Chip
                size="small"
                label="No upstream"
                sx={{
                  fontSize: "0.65rem",
                  fontWeight: 500,
                  bgcolor: "rgba(100, 116, 139, 0.1)",
                  color: "#64748b",
                }}
              />
            ) : null}
          </Box>
        </Box>

        {/* Working Tree Warning if dirty */}
        {isDirty && (
          <Alert
            severity="warning"
            icon={<WarningAmberIcon fontSize="small" />}
            sx={{
              mb: 1,
              py: 0.25,
              px: 1,
              fontSize: "0.74rem",
              borderRadius: 1.5,
              "& .MuiAlert-message": { py: 0.25 },
            }}
          >
            Working tree has <strong>{uncommittedCount} uncommitted change(s)</strong>. Commit or stash first — checkout may fail or carry these changes to the new branch.
          </Alert>
        )}

        {/* Search input */}
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

        {/* Restart switch */}
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
                  Restart service after checkout / pull
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

        {/* Branch List */}
        <Box sx={{ overflowY: "auto", flex: 1, maxHeight: 230 }}>
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
