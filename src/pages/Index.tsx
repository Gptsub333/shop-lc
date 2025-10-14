import { useState } from "react";
import VoiceChatButton from "@/components/VoiceChatButton";
import ChatPanel from "@/components/ChatPanel";
import ProductCard from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
import heroImage from "@/assets/hero-jewelry.jpg";
import diamondRing from "@/assets/diamond-ring.jpg";
import goldNecklace from "@/assets/gold-necklace.jpg";
import pearlEarrings from "@/assets/pearl-earrings.jpg";
import roseBracelet from "@/assets/rose-bracelet.jpg";
import emeraldRing from "@/assets/emerald-ring.jpg";
import sapphireStuds from "@/assets/sapphire-studs.jpg";
import tennisBracelet from "@/assets/tennis-bracelet.jpg";
import goldLocket from "@/assets/gold-locket.jpg";

const products = [
  {
    id: 1,
    image: diamondRing,
    name: "Diamond Solitaire Ring",
    price: "$2,499",
    description: "Elegant platinum band with brilliant cut diamond, perfect for engagements",
  },
  {
    id: 2,
    image: goldNecklace,
    name: "Diamond Pendant Necklace",
    price: "$899",
    description: "Delicate 18K gold chain with sparkling diamond pendant",
  },
  {
    id: 3,
    image: pearlEarrings,
    name: "Pearl Drop Earrings",
    price: "$649",
    description: "Luxurious cultured pearls with gold accents, timeless elegance",
  },
  {
    id: 4,
    image: roseBracelet,
    name: "Rose Gold Diamond Bracelet",
    price: "$1,299",
    description: "Modern rose gold design with delicate diamond accents",
  },
  {
    id: 5,
    image: emeraldRing,
    name: "Emerald & Gold Ring",
    price: "$3,199",
    description: "Stunning emerald centerpiece with diamond accents in gold setting",
  },
  {
    id: 6,
    image: sapphireStuds,
    name: "Sapphire Stud Earrings",
    price: "$1,899",
    description: "Deep blue sapphires in elegant white gold settings",
  },
  {
    id: 7,
    image: tennisBracelet,
    name: "Diamond Tennis Bracelet",
    price: "$4,299",
    description: "Classic platinum tennis bracelet with brilliant diamonds",
  },
  {
    id: 8,
    image: goldLocket,
    name: "Vintage Gold Locket",
    price: "$749",
    description: "Intricate engraved gold locket, perfect for treasured memories",
  },
];

const Index = () => {
  const [isChatOpen, setIsChatOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative h-[70vh] overflow-hidden">
        <div className="absolute inset-0">
          <img
            src={heroImage}
            alt="Luxury jewelry collection"
            className="w-full h-full object-cover brightness-75"
          />
        </div>
        <div className="relative h-full flex items-center justify-center text-center px-4">
          <div className="max-w-3xl space-y-6 animate-fade-in">
            <h1 className="text-5xl md:text-7xl font-bold text-primary-foreground drop-shadow-lg">
              ShopLC Jewelry
            </h1>
            <p className="text-xl md:text-2xl text-primary-foreground/90 drop-shadow-md">
              Discover Timeless Elegance & Luxury
            </p>
            <Button
              size="lg"
              className="bg-accent hover:bg-accent/90 text-accent-foreground text-lg px-8 py-6 shadow-xl hover:scale-105 transition-transform"
            >
              Explore Collection
            </Button>
          </div>
        </div>
      </section>

      {/* Products Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="text-center mb-12 space-y-4">
          <h2 className="text-4xl md:text-5xl font-bold text-foreground">
            Featured Collection
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Explore our curated selection of exquisite jewelry pieces, crafted with precision and designed to last a lifetime
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              image={product.image}
              name={product.name}
              price={product.price}
              description={product.description}
            />
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-secondary py-20">
        <div className="container mx-auto px-4 text-center space-y-6">
          <h2 className="text-3xl md:text-4xl font-bold text-secondary-foreground">
            Can't Find What You're Looking For?
          </h2>
          <p className="text-lg text-secondary-foreground/80 max-w-2xl mx-auto">
            Our expert jewelers can create custom pieces tailored to your vision
          </p>
          <Button
            size="lg"
            className="bg-accent hover:bg-accent/90 text-accent-foreground px-8 py-6"
          >
            Contact Us
          </Button>
        </div>
      </section>

      <VoiceChatButton onClick={() => setIsChatOpen(true)} />
      <ChatPanel isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
    </div>
  );
};

export default Index;
