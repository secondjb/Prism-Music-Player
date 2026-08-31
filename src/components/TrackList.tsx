import React from 'react';
import { Track } from '../types/player';
import { TrackGridView } from './TrackGridView';

interface TrackListProps {
  tracks: Track[];
}

export const TrackList: React.FC<TrackListProps> = ({ tracks }) => {
  return <TrackGridView tracks={tracks} />;
};
