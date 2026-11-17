import type { Artist, Category, Product } from "@/types/catalog";

export const categories: Category[] = [
  {
    slug: "ceramica",
    name: "Cerâmica",
    description:
      "Peças moldadas em pequenos lotes, com marcas do fazer manual.",
  },
  {
    slug: "textil",
    name: "Têxtil",
    description: "Tecidos, estampas e objetos inspirados pelos rios da serra.",
  },
  {
    slug: "papel-e-gravura",
    name: "Papel & gravura",
    description:
      "Impressões autorais e papelaria para colecionar e presentear.",
  },
];

export const artists: Artist[] = [
  {
    slug: "ana-bruma",
    name: "Ana Bruma",
    discipline: "Cerâmica",
    location: "Lumiar, Nova Friburgo",
    introduction:
      "Formas orgânicas e esmaltes que guardam as cores das manhãs na serra.",
    biography:
      "Ana pesquisa argilas, cinzas e pigmentos em peças de uso cotidiano. Seu processo valoriza pequenas variações e a presença visível das mãos em cada objeto.",
    image: {
      src: "/images/artistas-coletivo.webp",
      alt: "Retrato demonstrativo de uma ceramista em seu ateliê",
      position: "0% center",
    },
    socialLabel: "Perfil demonstrativo · rede social em breve",
    featured: true,
  },
  {
    slug: "caio-matriz",
    name: "Caio Matriz",
    discipline: "Gravura",
    location: "São Pedro da Serra, Nova Friburgo",
    introduction:
      "Paisagens impressas à mão, entre caminhos, folhas e montanhas.",
    biography:
      "Caio trabalha com linoleogravura e monotipia. As matrizes nascem de caminhadas e desenhos de observação, transformados em séries curtas e numeradas.",
    image: {
      src: "/images/artistas-coletivo.webp",
      alt: "Retrato demonstrativo de um gravurista ao lado de uma prensa",
      position: "34% center",
    },
    socialLabel: "Perfil demonstrativo · rede social em breve",
    featured: true,
  },
  {
    slug: "maya-rios",
    name: "Maya Rios",
    discipline: "Arte têxtil",
    location: "Lumiar, Nova Friburgo",
    introduction: "Estampas livres que acompanham o curso da água e da mata.",
    biography:
      "Maya combina desenho, carimbos e impressão artesanal sobre fibras naturais. Suas peças exploram ritmo, repetição e as relações entre corpo e território.",
    image: {
      src: "/images/artistas-coletivo.webp",
      alt: "Retrato demonstrativo de uma artista têxtil com tecidos estampados",
      position: "67% center",
    },
    socialLabel: "Perfil demonstrativo · rede social em breve",
    featured: true,
  },
  {
    slug: "tomas-serra",
    name: "Tomás Serra",
    discipline: "Papel artesanal",
    location: "Nova Friburgo, RJ",
    introduction:
      "Cadernos e papéis feitos devagar, para ideias que pedem permanência.",
    biography:
      "Tomás cria papéis de fibras vegetais e encadernações de pequena escala. O ateliê investiga reaproveitamento, textura e formas simples de guardar memórias.",
    image: {
      src: "/images/artistas-coletivo.webp",
      alt: "Retrato demonstrativo de um artista de papel em uma bancada",
      position: "100% center",
    },
    socialLabel: "Perfil demonstrativo · rede social em breve",
    featured: true,
  },
];

const ceramicImage = {
  src: "/images/produtos/ceramica-serra.webp",
  alt: "Caneca e vaso artesanais com pintura de montanhas",
};

const textileImage = {
  src: "/images/produtos/textil-rios.webp",
  alt: "Bolsa e tecido artesanais com estampa de rio e mata",
};

const paperImage = {
  src: "/images/produtos/papel-gravura.webp",
  alt: "Caderno, gravuras e matriz artesanal em composição de ateliê",
};

const studioImage = {
  src: "/images/hero-serra.webp",
  alt: "Ateliê com cerâmicas, tecidos e gravuras diante das montanhas",
};

export const products: Product[] = [
  {
    slug: "caneca-horizonte",
    name: "Caneca Horizonte",
    artistSlug: "ana-bruma",
    categorySlug: "ceramica",
    priceInCents: 11800,
    shortDescription: "Stoneware modelado à mão com esmalte de paisagem.",
    description:
      "Uma caneca de presença serena, criada em pequenos lotes. A pintura em camadas cria uma paisagem única em cada peça, sem reprodução idêntica.",
    materials: ["Stoneware", "Esmalte atóxico", "Queima em alta temperatura"],
    dimensions: "Aproximadamente 9 × 9 cm · 320 ml",
    variations: ["Neblina", "Mata"],
    image: ceramicImage,
    gallery: [ceramicImage, studioImage, ceramicImage],
    featured: true,
  },
  {
    slug: "vaso-neblina",
    name: "Vaso Neblina",
    artistSlug: "ana-bruma",
    categorySlug: "ceramica",
    priceInCents: 18900,
    shortDescription: "Vaso de formas arredondadas e pintura em camadas.",
    description:
      "Peça escultórica para pequenas folhagens ou para compor a casa sozinha. A superfície preserva variações de esmalte próprias do processo artesanal.",
    materials: ["Stoneware", "Pigmentos minerais", "Esmalte acetinado"],
    dimensions: "Aproximadamente 16 × 14 cm",
    variations: ["Mata", "Horizonte"],
    image: ceramicImage,
    gallery: [ceramicImage, studioImage, ceramicImage],
    featured: false,
  },
  {
    slug: "bolsa-mapa-afetivo",
    name: "Bolsa Mapa Afetivo",
    artistSlug: "maya-rios",
    categorySlug: "textil",
    priceInCents: 7800,
    shortDescription: "Bolsa de linho estampada manualmente em pequena série.",
    description:
      "Uma bolsa ampla para acompanhar a rotina. A estampa reúne rios, folhas e caminhos em uma cartografia inventada da região serrana.",
    materials: ["Linho misto", "Tinta à base d’água", "Alça reforçada"],
    dimensions: "38 × 42 cm · alça de 62 cm",
    variations: ["Rio azul", "Mata verde"],
    image: textileImage,
    gallery: [textileImage, studioImage, textileImage],
    featured: true,
  },
  {
    slug: "lenco-rios-da-serra",
    name: "Lenço Rios da Serra",
    artistSlug: "maya-rios",
    categorySlug: "textil",
    priceInCents: 14500,
    shortDescription:
      "Lenço leve com desenho corrido inspirado nos rios locais.",
    description:
      "Estampa autoral aplicada em tecido leve, com pequenas diferenças entre as unidades. Pode ser usado no corpo, no cabelo ou como detalhe de composição.",
    materials: ["Seda e algodão", "Impressão artesanal", "Acabamento manual"],
    dimensions: "70 × 70 cm",
    variations: ["Argila", "Céu"],
    image: textileImage,
    gallery: [textileImage, studioImage, textileImage],
    featured: true,
  },
  {
    slug: "caderno-caminho-da-mata",
    name: "Caderno Caminho da Mata",
    artistSlug: "tomas-serra",
    categorySlug: "papel-e-gravura",
    priceInCents: 6400,
    shortDescription:
      "Encadernação manual com capa impressa e papel de desenho.",
    description:
      "Caderno de abertura confortável, criado para desenhos, anotações e projetos. A capa recebe uma impressão manual inspirada em trilhas da mata.",
    materials: ["Papel pólen", "Capa em papel artesanal", "Costura aparente"],
    dimensions: "14 × 20 cm · 96 páginas",
    variations: ["Folha", "Caminho"],
    image: paperImage,
    gallery: [paperImage, studioImage, paperImage],
    featured: true,
  },
  {
    slug: "gravura-encontros",
    name: "Gravura Encontros",
    artistSlug: "caio-matriz",
    categorySlug: "papel-e-gravura",
    priceInCents: 16000,
    shortDescription: "Linoleogravura numerada, impressa manualmente.",
    description:
      "Uma edição curta sobre caminhos que se cruzam na serra. Cada impressão é entintada e prensada à mão, preservando pequenas marcas do processo.",
    materials: ["Papel algodão", "Tinta gráfica", "Assinatura e numeração"],
    dimensions: "Imagem 24 × 30 cm · papel 30 × 42 cm",
    variations: ["Verde mata", "Azul profundo"],
    image: paperImage,
    gallery: [paperImage, studioImage, paperImage],
    featured: true,
  },
  {
    slug: "cartoes-folhas-da-serra",
    name: "Cartões Folhas da Serra",
    artistSlug: "caio-matriz",
    categorySlug: "papel-e-gravura",
    priceInCents: 4800,
    shortDescription: "Conjunto de quatro cartões impressos à mão.",
    description:
      "Pequenas gravuras botânicas para enviar, emoldurar ou guardar. O conjunto reúne quatro composições diferentes em envelope de papel reciclado.",
    materials: ["Papel reciclado", "Tinta gráfica", "Envelope artesanal"],
    dimensions: "4 cartões de 10 × 15 cm",
    variations: ["Conjunto único"],
    image: paperImage,
    gallery: [paperImage, studioImage, paperImage],
    featured: false,
  },
  {
    slug: "bloco-de-notas-bruma",
    name: "Bloco de Notas Bruma",
    artistSlug: "tomas-serra",
    categorySlug: "papel-e-gravura",
    priceInCents: 4200,
    shortDescription:
      "Bloco destacável com bordas irregulares e capa serigrafada.",
    description:
      "Um bloco simples e tátil para listas, recados e pequenas ideias. Produzido com aproveitamento de cortes do ateliê de papel.",
    materials: ["Papel artesanal", "Capa serigrafada", "Colagem removível"],
    dimensions: "10 × 16 cm · 60 folhas",
    variations: ["Bruma", "Musgo"],
    image: paperImage,
    gallery: [paperImage, studioImage, paperImage],
    featured: false,
  },
];

export function getArtistBySlug(slug: string): Artist | undefined {
  return artists.find((artist) => artist.slug === slug);
}

export function getProductBySlug(slug: string): Product | undefined {
  return products.find((product) => product.slug === slug);
}

export function getProductsByArtist(artistSlug: string): Product[] {
  return products.filter((product) => product.artistSlug === artistSlug);
}

export function getCategoryBySlug(slug: string): Category | undefined {
  return categories.find((category) => category.slug === slug);
}
