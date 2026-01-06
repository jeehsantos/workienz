// Centralized Employee Profile Schema
export interface EmployeeProfileData {
  // Identity
  fullName: string;
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl?: string;
  dateOfBirth?: string;
  
  // Professional
  professionalTitle: string;
  bio: string;
  industry: string;
  experienceYears: number | null;
  availability: string;
  isAvailable: boolean;
  
  // Contact & Location
  phone: string;
  country: string;
  region: string;
  city: string;
  suburb: string;
  
  // Skills & Languages
  skills: string[];
  languages: string[];
  
  // Compliance
  visaStatus: string;
  irdNumber: string;
  
  // Work Preferences
  comfortableHeavyLifting: boolean;
  comfortableStanding: boolean;
  hasCar: boolean;
  hasIrdNumber: boolean;
  
  // Social Links (optional)
  linkedinUrl?: string;
  websiteUrl?: string;
}

export interface Education {
  institution: string;
  degree: string;
  field: string;
  startYear: number;
  endYear?: number;
  current?: boolean;
}

export interface Experience {
  company: string;
  position: string;
  description: string;
  startDate: string;
  endDate?: string;
  current?: boolean;
}

export type ProfileViewMode = 'social' | 'formal';
