// Sample module for context-diet benchmarks
import React, { useState, useEffect } from "react";
import axios from "axios";

export interface Profile {
  id: string;
  displayName: string;
  avatarUrl: string;
}

/**
 * Loads user profile data from the remote API.
 */
export async function loadProfile(userId: string): Promise<Profile> {
  const { data } = await axios.get(`/api/users/${userId}`);
  return data;
}

export const formatName = (first: string, last: string): string => {
  return `${first} ${last}`.trim();
};
