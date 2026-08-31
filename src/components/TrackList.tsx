import React from 'react';
import { Track } from '../types/player';
import { TrackTableView } from './TrackTableView';

interface TrackListProps {
  tracks: Track[];
}

export const TrackList: React.FC<TrackListProps> = ({ tracks }) => {
  return <TrackTableView tracks={tracks} />;
};

