import React from 'react';
import { Track } from '../types/player';
import { TrackTableView } from './TrackTableView';

interface TrackListProps {
  tracks: Track[];
  hideControls?: boolean;
}

export const TrackList: React.FC<TrackListProps> = ({ tracks, hideControls }) => {
  return <TrackTableView tracks={tracks} hideControls={hideControls} />;
};

