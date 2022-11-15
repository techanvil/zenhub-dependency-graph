/**
 * External dependencies
 */
import { useState, useEffect } from "react";

export const getStorageValue = (key, defaultValue) => {
  // Getting stored value.
  const saved = localStorage.getItem(key);

  let initial;

  try {
    initial = JSON.parse(saved);
  } catch (err) {
    console.log("JSON parse error", err);
  }

  return initial || defaultValue;
};

export const useLocalStorage = (key, defaultValue) => {
  const [value, setValue] = useState(() => {
    return getStorageValue(key, defaultValue);
  });

  useEffect(() => {
    // Storing input.
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue];
};
