
# Daily Rotating Images for RolesSection

## Overview
Update the RolesSection component to display rotating images that change daily. Each role card will have 2 images that alternate based on the current day.

## Image Assignment

| Card | Image Set |
|------|-----------|
| "I'm Hiring" (left) | FarmManagers.png, WeddingManagers.png |
| "I'm Looking for Work" (right) | WarehouseWorkers.jpg, CherryWorkers.png |

## Implementation Steps

### 1. Copy Images to Project
Copy the 4 uploaded images to `src/assets/landing/`:
- `src/assets/landing/FarmManagers.png`
- `src/assets/landing/WeddingManagers.png`
- `src/assets/landing/WarehouseWorkers.jpg`
- `src/assets/landing/CherryWorkers.png`

### 2. Update RolesSection Component

**Changes to `src/components/landing/RolesSection.tsx`:**

```typescript
// New imports for all 4 images
import farmManagers from "@/assets/landing/FarmManagers.png";
import weddingManagers from "@/assets/landing/WeddingManagers.png";
import warehouseWorkers from "@/assets/landing/WarehouseWorkers.jpg";
import cherryWorkers from "@/assets/landing/CherryWorkers.png";

// Image arrays for each role
const hiringImages = [farmManagers, weddingManagers];
const workImages = [warehouseWorkers, cherryWorkers];

// Helper function to get daily image index
const getDailyImageIndex = (imageCount: number): number => {
  const today = new Date();
  const dayOfYear = Math.floor(
    (today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) 
    / (1000 * 60 * 60 * 24)
  );
  return dayOfYear % imageCount;
};
```

**Update roles data structure:**
- Change `image` property to `images` array
- "I'm Hiring" card: `images: hiringImages`
- "I'm Looking for Work" card: `images: workImages`

**Update image rendering:**
```typescript
// Inside the component, calculate which image to show
const dailyIndex = getDailyImageIndex(role.images.length);
const currentImage = role.images[dailyIndex];
```

## Technical Details

### Daily Rotation Logic
- Uses the day of the year (1-365/366) modulo the number of images
- This ensures consistent rotation across all users viewing the site on the same day
- No backend required - calculation happens client-side based on current date
- Images will change at midnight local time

### Performance Considerations
- Images are imported as ES6 modules for proper bundling and optimization
- Using Vite's asset handling for optimal loading
- Images stored in `src/assets` for type safety and better tree-shaking

## File Changes Summary

| File | Action |
|------|--------|
| `src/assets/landing/FarmManagers.png` | Create (copy from upload) |
| `src/assets/landing/WeddingManagers.png` | Create (copy from upload) |
| `src/assets/landing/WarehouseWorkers.jpg` | Create (copy from upload) |
| `src/assets/landing/CherryWorkers.png` | Create (copy from upload) |
| `src/components/landing/RolesSection.tsx` | Modify |

## Expected Result
- Each day, visitors will see a different image on each card
- Day 1: FarmManagers + WarehouseWorkers
- Day 2: WeddingManagers + CherryWorkers
- Day 3: FarmManagers + WarehouseWorkers (cycle repeats)
