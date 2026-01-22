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
  
  // Work Preferences
  comfortableHeavyLifting: boolean;
  comfortableStanding: boolean;
  hasCar: boolean;
  hasIrdNumber: boolean;
  
  // Social Links (optional)
  linkedinUrl?: string;
  websiteUrl?: string;

  // Formal CV fields
  enableFormalCv: boolean;
  workExperience: WorkExperience[];
  education: Education[];
  cvReferences: CVReference[];
}

export interface WorkExperience {
  id: string;
  company: string;
  position: string;
  description: string;
  startDate: string;
  endDate?: string;
  current?: boolean;
}

export interface Education {
  id: string;
  institution: string;
  degree: string;
  field: string;
  startYear: number;
  endYear?: number;
  current?: boolean;
}

export interface CVReference {
  id: string;
  name: string;
  position: string;
  company: string;
  email?: string;
  phone?: string;
}

export type ProfileViewMode = 'social' | 'formal';
