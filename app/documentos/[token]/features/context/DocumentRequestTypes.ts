export type DocumentRequestItem = {
  id: string;
  name: string;
  description?: string | null;
  isRequired: boolean;
  uploadedAt: string | null;
};

export type DocumentRequestData = {
  id: string;
  status: string;
  message?: string | null;
  lead: { name: string };
  createdBy: { fullName: string | null };
  items: DocumentRequestItem[];
};

export type DocumentRequestContextValue = {
  token: string;
  request: DocumentRequestData | null;
  isLoading: boolean;
  error: string | null;
  markItemUploaded: (itemId: string, uploadedAt: string) => void;
  uploadItem: (itemId: string, file: File) => Promise<boolean>;
};
