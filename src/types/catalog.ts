export type Category = {
  slug: string;
  name: string;
  description: string;
};

export type CatalogImage = {
  src: string;
  alt: string;
  position?: string;
};

export type Product = {
  slug: string;
  name: string;
  artistSlug: string;
  categorySlug: string;
  priceInCents: number;
  shortDescription: string;
  description: string;
  materials: string[];
  dimensions: string;
  variations: string[];
  image: CatalogImage;
  gallery: CatalogImage[];
  featured: boolean;
};

export type Artist = {
  slug: string;
  name: string;
  discipline: string;
  location: string;
  introduction: string;
  biography: string;
  image: CatalogImage;
  socialLabel: string;
  featured: boolean;
};
