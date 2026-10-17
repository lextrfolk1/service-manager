import { useMemo } from "react";
import { Autocomplete, Box, Chip, InputAdornment, TextField, Typography } from "@mui/material";
import { Search as SearchIcon } from "@mui/icons-material";
import { CODE_FONT } from "../theme/tokens";

// Search box that also filters. While typing it suggests filter values ("Type: java"), including one suggestion
// combining several words ("running java core" → Status: Running + Type: java + Group: Core). Picked values
// become chips; the remaining text is a plain search over every field. "key:value" searches one field
// (port:8080, name:auth, type:java); the keys are suggested too.
//
// fields: [{ key, label, options: [{ value, label }], aliases?: { [value]: [words] }, text?: true }]
// Text fields are only searched (their options, if any, are offered as completions); the others are filters.
// selected: { [fieldKey]: values[] }; text: the plain search text.
// previewCount(nextSelected, nextText): how many services would show, used for the counts in suggestions.
// onTextChange: every keystroke; onSubmit(text): apply the text now (Enter, a picked suggestion, clearing).

function scoreWord(word, field, option) {
  const label = String(option.label).toLowerCase();
  const value = String(option.value).toLowerCase();
  const aliases = (field.aliases?.[option.value] || []).map((alias) => alias.toLowerCase());
  if (label === word || value === word || aliases.includes(word)) return 3;
  if (label.startsWith(word) || value.startsWith(word) || aliases.some((alias) => alias.startsWith(word))) return word.length >= 2 ? 2 : 0;
  if (word.length >= 3 && (label.includes(word) || value.includes(word))) return 1;
  return 0;
}

// "type:jav" → the Type field and "jav", when the part before ":" starts a field's key or label.
export function splitFieldToken(word, fields) {
  const colon = word.indexOf(":");
  if (colon < 1) return null;
  const prefix = word.slice(0, colon).toLowerCase();
  const field =
    fields.find((item) => item.key === prefix || item.label.toLowerCase() === prefix) ||
    fields.find((item) => item.key.startsWith(prefix) || item.label.toLowerCase().startsWith(prefix));
  return field ? { field, value: word.slice(colon + 1).toLowerCase() } : null;
}

function withValue(selected, key, value) {
  const current = selected[key] || [];
  return current.includes(value) ? selected : { ...selected, [key]: [...current, value] };
}

export default function SmartSearch({ fields, selected, text, onTextChange, onSubmit, previewCount, onSelectedChange, inputRef, placeholder, ariaLabel = "Search or filter services" }) {
  const chips = useMemo(
    () => fields.flatMap((field) => (selected[field.key] || []).map((value) => ({
      field,
      value,
      label: field.options.find((option) => option.value === value)?.label || value,
    }))),
    [fields, selected]
  );

  const suggestions = useMemo(() => {
    const filterFields = fields.filter((field) => !field.text);
    const isSelected = (field, option) => (selected[field.key] || []).includes(option.value);
    const words = text.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const join = (...parts) => parts.filter(Boolean).join(" ");
    const valueSuggestion = (field, option, nextText, group) => {
      const next = withValue(selected, field.key, option.value);
      return { kind: "value", group, parts: [{ field, option }], nextText, label: `${field.label}: ${option.label}`, count: previewCount(next, nextText) };
    };
    const keySuggestion = (field, before) => ({
      kind: "key",
      group: "Search by",
      parts: [],
      nextText: `${join(before, `${field.key}:`)}`,
      label: `${field.key}:`,
      hint: field.label,
    });

    if (!words.length) {
      // Nothing typed: only a row of keys to start from; values are suggested as you type.
      return [{ kind: "hint", group: "Type to search everything, or start with a key", label: "" }];
    }

    const results = [];
    // Best filter value for each word (key:value words only look in that field).
    const matches = words.map((word) => {
      const token = splitFieldToken(word, fields);
      if (token?.field.text) return { word, token, best: null };
      const candidates = token ? [token.field] : filterFields;
      const term = token ? token.value : word;
      let best = null;
      candidates.forEach((field) => field.options.forEach((option) => {
        if (isSelected(field, option)) return;
        const score = token && !term ? 1 : scoreWord(term, field, option);
        if (score > 0 && (!best || score > best.score)) best = { field, option, score };
      }));
      return { word, token, best };
    });

    // Several words that each name a value: one suggestion applying them all.
    const strong = matches.filter((match) => match.best && (match.best.score >= 2 || match.token));
    const distinct = strong.filter((match, index) => strong.findIndex((other) => other.best.field.key === match.best.field.key && other.best.option.value === match.best.option.value) === index);
    if (distinct.length >= 2) {
      const leftover = matches.filter((match) => !strong.includes(match)).map((match) => match.word).join(" ");
      let next = selected;
      distinct.forEach(({ best }) => { next = withValue(next, best.field.key, best.option.value); });
      const count = previewCount(next, leftover);
      if (count > 0) {
        results.push({
          kind: "combo",
          group: "Combine",
          parts: distinct.map(({ best }) => best),
          nextText: leftover,
          label: distinct.map(({ best }) => `${best.field.label}: ${best.option.label}`).join(" + ") + (leftover ? ` + “${leftover}”` : ""),
          count,
        });
      }
    }

    // Suggestions for the last word being typed (the other words stay as they are).
    const last = matches[matches.length - 1];
    const before = words.slice(0, -1).join(" ");
    const term = last.token ? last.token.value : last.word;

    if (last.token?.field.text) {
      // key:value on a text field: complete with values that exist.
      const field = last.token.field;
      field.options
        .filter((option) => String(option.label).toLowerCase().includes(term))
        .map((option) => {
          const nextText = join(before, `${field.key}:${option.value}`);
          return { kind: "complete", group: field.label, parts: [], nextText, label: `${field.key}:${option.label}`, count: previewCount(selected, nextText) };
        })
        .filter((suggestion) => suggestion.count > 0)
        .slice(0, 8)
        .forEach((suggestion) => results.push(suggestion));
      return results;
    }

    const scored = [];
    (last.token ? [last.token.field] : filterFields).forEach((field) => field.options.forEach((option) => {
      if (isSelected(field, option)) return;
      const score = last.token && !term ? 1 : scoreWord(term, field, option);
      if (score > 0) scored.push({ field, option, score });
    }));
    scored
      .sort((a, b) => b.score - a.score)
      .map(({ field, option }) => valueSuggestion(field, option, before, "Filter by"))
      .filter((suggestion) => suggestion.count > 0)
      .slice(0, 8)
      .forEach((suggestion) => results.push(suggestion));

    // The start of a key ("por" → port:).
    if (!last.token && last.word.length >= 2) {
      fields
        .filter((field) => field.key.startsWith(last.word) || field.label.toLowerCase().startsWith(last.word))
        .forEach((field) => results.push(keySuggestion(field, before)));
    }
    return results;
  }, [fields, previewCount, selected, text]);

  const applySuggestion = (suggestion) => {
    if (suggestion.parts.length) {
      let next = selected;
      suggestion.parts.forEach(({ field, option }) => { next = withValue(next, field.key, option.value); });
      onSelectedChange(next);
    }
    if (suggestion.kind === "key") onTextChange(suggestion.nextText); // still typing: "port:" needs a value
    else onSubmit(suggestion.nextText);
  };

  return (
    <Autocomplete
      multiple
      freeSolo
      size="small"
      fullWidth
      openOnFocus
      autoHighlight
      clearOnEscape
      clearOnBlur={false}
      disableCloseOnSelect={false}
      value={chips}
      inputValue={text}
      options={suggestions}
      filterOptions={(options) => options}
      groupBy={(option) => option.group}
      getOptionLabel={(option) => (typeof option === "string" ? option : option.label)}
      getOptionDisabled={(option) => option.kind !== "key" && option.count === 0}
      isOptionEqualToValue={() => false}
      onInputChange={(_, value, reason) => {
        if (reason !== "reset") onTextChange(value);
      }}
      onChange={(_, value, reason) => {
        const added = value[value.length - 1];
        if (reason === "selectOption" && added && added.kind) {
          if (added.kind !== "hint") applySuggestion(added);
          return;
        }
        if (reason === "createOption") {
          onSubmit(text); // Enter with no suggestion: search the text now
          return;
        }
        // A chip was removed (✕ or Backspace) or everything was cleared.
        const next = {};
        value.filter((chip) => chip.field).forEach((chip) => {
          next[chip.field.key] = [...(next[chip.field.key] || []), chip.value];
        });
        onSelectedChange(Object.fromEntries(fields.map((field) => [field.key, next[field.key] || []])));
        if (reason === "clear") onSubmit("");
      }}
      renderTags={(value, getTagProps) => value.map((chip, index) => {
        const { key, ...tagProps } = getTagProps({ index });
        return (
          <Chip
            key={key}
            {...tagProps}
            size="small"
            color="primary"
            variant="outlined"
            label={
              <span>
                <Box component="span" sx={{ fontWeight: 400, opacity: 0.8 }}>{chip.field.label}: </Box>
                {chip.label}
              </span>
            }
            sx={{ height: 24, fontSize: "0.76rem", fontWeight: 600, bgcolor: "color-mix(in srgb, var(--sm-accent) 8%, transparent)" }}
          />
        );
      })}
      renderOption={(props, option) => {
        const { key, ...optionProps } = props;
        if (option.kind === "hint") {
          return (
            <Box component="li" key={key} {...optionProps} sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, cursor: "default !important" }}>
              {fields.map((field) => (
                <Chip
                  key={field.key}
                  size="small"
                  variant="outlined"
                  label={`${field.key}:`}
                  title={field.label}
                  onMouseDown={(event) => event.preventDefault()} // keep focus in the search box
                  onClick={(event) => {
                    event.stopPropagation();
                    onTextChange(`${field.key}:`);
                  }}
                  sx={{ fontFamily: CODE_FONT, fontSize: "0.75rem", cursor: "pointer" }}
                />
              ))}
            </Box>
          );
        }
        return (
          <Box component="li" key={key} {...optionProps} sx={{ display: "flex", gap: 1, fontSize: "0.85rem" }}>
            <Box
              component="span"
              sx={{
                flex: 1,
                fontWeight: option.kind === "combo" ? 700 : 400,
                fontFamily: option.kind === "key" || option.kind === "complete" ? CODE_FONT : "inherit",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {option.label}
            </Box>
            <Typography component="span" sx={{ fontSize: "0.75rem", color: "text.secondary", flexShrink: 0 }}>
              {option.kind === "key" ? option.hint : option.count}
            </Typography>
          </Box>
        );
      }}
      ListboxProps={{ sx: { maxHeight: 380 } }}
      slotProps={{ paper: { sx: { borderRadius: 2, mt: 0.5 } } }}
      renderInput={(params) => (
        <TextField
          {...params}
          inputRef={inputRef}
          placeholder={chips.length ? "" : placeholder}
          inputProps={{ ...params.inputProps, "aria-label": ariaLabel }}
          InputProps={{
            ...params.InputProps,
            startAdornment: (
              <>
                <InputAdornment position="start" sx={{ ml: 0.5 }}>
                  <SearchIcon sx={{ fontSize: "1rem" }} />
                </InputAdornment>
                {params.InputProps.startAdornment}
              </>
            ),
            sx: { minHeight: 32, py: "2px !important", fontSize: "0.82rem", borderRadius: "16px" },
          }}
        />
      )}
    />
  );
}
