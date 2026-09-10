import React from 'react';
import { Track } from '../types/player';
import { TrackTableView } from './TrackTableView';

interface TrackListProps {
  tracks: Track[];
  hideControls?: boolean;
  autoHeight?: boolean;
}

export const TrackList: React.FC<TrackListProps> = ({ tracks, hideControls, autoHeight }) => {
  return <TrackTableView tracks={tracks} hideControls={hideControls} autoHeight={autoHeight} />;
};

