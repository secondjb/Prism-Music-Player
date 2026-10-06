import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import ToggleButton from '@mui/material/ToggleButton';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  LayoutGrid,
  List,
} from 'lucide-react';

export interface SortOption<T extends string = string> {
  id: T;
  label: string;
  defaultDir: 'asc' | 'desc';
}

export interface ViewHeaderControlsProps<T extends string = string> {
  sortOptions: readonly SortOption<T>[] | SortOption<T>[];
  sortKey: T;
  sortDir: 'asc' | 'desc';
  onSortChange: (key: T, dir: 'asc' | 'desc') => void;
  viewMode: 'grid' | 'list';
  onViewModeChange: (mode: 'grid' | 'list') => void;
  title?: string;
  countLabel?: string;
}

export const ViewHeaderControls = <T extends string>({
  sortOptions,
  sortKey,
  sortDir,
  onSortChange,
  viewMode,
  onViewModeChange,
  title,
  countLabel,
}: ViewHeaderControlsProps<T>) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const currentOption = sortOptions.find((o) => o.id === sortKey) || sortOptions[0];

  const handleToggleDir = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSortChange(sortKey, sortDir === 'asc' ? 'desc' : 'asc');
  };

  const handleSelectOption = (opt: SortOption<T>) => {
    if (opt.id === sortKey) {
      onSortChange(opt.id, sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      onSortChange(opt.id, opt.defaultDir);
    }
    setAnchorEl(null);
  };

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 1.5,
        mb: 2.5,
      }}
    >
      {/* Title & Count */}
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'baseline' }}>
        {title && (
          <Typography variant="h6" sx={{ fontWeight: 700, color: '#ffffff', letterSpacing: '-0.01em' }}>
            {title}
          </Typography>
        )}
        {countLabel && (
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
            {countLabel}
          </Typography>
        )}
      </Stack>

      {/* Sort Menu & View Mode Toggle */}
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
        {/* Sort Menu Button */}
        <Button
          size="small"
          onClick={(e) => setAnchorEl(e.currentTarget)}
          startIcon={<ArrowUpDown size={14} style={{ color: 'var(--color-stop-1, #6366f1)' }} />}
          endIcon={
            <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
              <Box onClick={handleToggleDir} sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                {sortDir === 'desc' ? (
                  <ArrowDown size={14} strokeWidth={2.5} style={{ color: 'var(--color-stop-1, #6366f1)' }} />
                ) : (
                  <ArrowUp size={14} strokeWidth={2.5} style={{ color: 'var(--color-stop-1, #6366f1)' }} />
                )}
              </Box>
              <ChevronDown
                size={14}
                style={{
                  color: 'var(--color-stop-1, #6366f1)',
                  transform: anchorEl ? 'rotate(180deg)' : 'none',
                  transition: 'transform 0.2s',
                }}
              />
            </Stack>
          }
          sx={{
            bgcolor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 15%, transparent)',
            color: 'var(--color-stop-1, #6366f1)',
            border: '1px solid color-mix(in srgb, var(--color-stop-1, #6366f1) 35%, transparent)',
            borderRadius: '12px',
            px: 1.5,
            py: 0.75,
            fontSize: '12px',
            fontWeight: 600,
            textTransform: 'none',
            '&:hover': {
              bgcolor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 25%, transparent)',
            },
          }}
        >
          {currentOption?.label}
        </Button>

        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={() => setAnchorEl(null)}
          slotProps={{
            paper: {
              sx: {
                minWidth: 160,
                p: 0.5,
              },
            },
          }}
        >
          <Typography
            variant="caption"
            sx={{
              display: 'block',
              px: 1.5,
              py: 0.5,
              fontWeight: 700,
              color: 'text.secondary',
              fontSize: '10px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Sort options
          </Typography>

          {sortOptions.map((opt) => {
            const isActive = sortKey === opt.id;
            return (
              <MenuItem
                key={opt.id}
                onClick={() => handleSelectOption(opt)}
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  bgcolor: isActive
                    ? 'color-mix(in srgb, var(--color-stop-1, #6366f1) 15%, transparent)'
                    : 'transparent',
                  color: isActive ? 'var(--color-stop-1, #6366f1)' : '#ffffff',
                  fontWeight: isActive ? 600 : 400,
                }}
              >
                <span>{opt.label}</span>
                {isActive && (
                  sortDir === 'desc' ? (
                    <ArrowDown size={14} strokeWidth={2.5} style={{ color: 'var(--color-stop-1, #6366f1)' }} />
                  ) : (
                    <ArrowUp size={14} strokeWidth={2.5} style={{ color: 'var(--color-stop-1, #6366f1)' }} />
                  )
                )}
              </MenuItem>
            );
          })}
        </Menu>

        {/* View Mode Toggle (Grid / List) */}
        <ToggleButtonGroup
          size="small"
          value={viewMode}
          exclusive
          onChange={(_, val) => {
            if (val) onViewModeChange(val);
          }}
          sx={{
            bgcolor: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '12px',
            p: 0.25,
            '& .MuiToggleButtonGroup-grouped': {
              border: 0,
              borderRadius: '8px !important',
              mx: 0.25,
              p: 0.75,
              color: '#a1a1aa',
              '&.Mui-selected': {
                bgcolor: 'rgba(255, 255, 255, 0.15)',
                color: '#ffffff',
                boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
              },
              '&:hover': {
                bgcolor: 'rgba(255, 255, 255, 0.1)',
                color: '#ffffff',
              },
            },
          }}
        >
          <ToggleButton value="grid" aria-label="Grid view">
            <Tooltip title="Grid View" arrow>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <LayoutGrid size={16} />
              </Box>
            </Tooltip>
          </ToggleButton>
          <ToggleButton value="list" aria-label="List view">
            <Tooltip title="List View" arrow>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <List size={16} />
              </Box>
            </Tooltip>
          </ToggleButton>
        </ToggleButtonGroup>
      </Stack>
    </Box>
  );
};
