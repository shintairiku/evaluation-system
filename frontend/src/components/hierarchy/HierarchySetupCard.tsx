"use client";

import React from 'react';
import HierarchyCard from './HierarchyCard';
import SupervisorSelector from './components/SupervisorSelector';
import SubordinateManager from './components/SubordinateManager';
import HierarchyDisplay from './components/HierarchyDisplay';
import type { HierarchySetupProps } from './types';

export default function HierarchySetupCard({
  userName,
  userEmail,
  selectedRoles,
  allUsers,
  selectedSupervisorId,
  selectedSubordinateIds,
  onSupervisorChange,
  onSubordinatesChange,
  getPotentialSupervisors,
  getPotentialSubordinates,
  disabled = false
}: HierarchySetupProps) {

  // Get current supervisor and subordinates based on selection
  const currentSupervisor = selectedSupervisorId 
    ? allUsers.find(u => u.id === selectedSupervisorId)
    : undefined;
  
  const currentSubordinates = allUsers.filter(u => 
    selectedSubordinateIds.includes(u.id)
  );

  // Handle supervisor changes
  const handleSupervisorChange = (supervisorId: string) => {
    onSupervisorChange(supervisorId);
  };

  const handleSupervisorRemove = () => {
    onSupervisorChange('');
  };

  // Handle subordinate changes
  const handleSubordinateAdd = (subordinateId: string) => {
    if (!selectedSubordinateIds.includes(subordinateId)) {
      onSubordinatesChange([...selectedSubordinateIds, subordinateId]);
    }
  };

  const handleSubordinateRemove = (subordinateId: string) => {
    onSubordinatesChange(selectedSubordinateIds.filter(id => id !== subordinateId));
  };

  return (
    <HierarchyCard mode="setup" disabled={disabled}>
      {/* Supervisor Section */}
      <SupervisorSelector
        mode="setup"
        currentSupervisor={currentSupervisor}
        potentialSupervisors={getPotentialSupervisors()}
        onSupervisorChange={handleSupervisorChange}
        onSupervisorRemove={handleSupervisorRemove}
        canEdit={true}
      />

      {/* Current User Display */}
      <HierarchyDisplay
        mode="setup"
        userName={userName}
        userEmail={userEmail}
        selectedRoles={selectedRoles}
        currentSupervisor={currentSupervisor}
        currentSubordinates={currentSubordinates}
      />

      {/* Subordinates Section */}
      <SubordinateManager
        mode="setup"
        currentSubordinates={currentSubordinates}
        potentialSubordinates={getPotentialSubordinates()}
        onSubordinateAdd={handleSubordinateAdd}
        onSubordinateRemove={handleSubordinateRemove}
        canEdit={true}
      />
    </HierarchyCard>
  );
}