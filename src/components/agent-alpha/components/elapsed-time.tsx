'use client';

import React, { useState, useEffect } from 'react';
import { formatDuration } from '../utils';

interface ElapsedTimeProps {
  startTime: number;
}

export const ElapsedTime: React.FC<ElapsedTimeProps> = ({ startTime }) => {
  const [elapsed, setElapsed] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Date.now() - startTime);
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);
  
  return <span>{formatDuration(elapsed)}</span>;
};
