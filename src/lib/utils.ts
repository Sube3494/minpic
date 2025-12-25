import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
}

export const getFileIcon = (fileType: string) => { // This is a placeholder since I can't import icons here easily without checking if lucide is used in utils. 
// Actually, utils usually shouldn't return components. It's better to keep this in a component or separate helper.
// But for now, to support the legacy component structure if needed? No, I am refactoring.
// I will NOT add getFileIcon here because it returns JSX. I should keep it in the component or a dedicated component.
};
