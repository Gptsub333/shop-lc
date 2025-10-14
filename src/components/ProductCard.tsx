import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface ProductCardProps {
    image: string;
    name: string;
    price: string;
    description: string;
}

const ProductCard = ({ image, name, price, description }: ProductCardProps) => {
    return (
        <Card className="group overflow-hidden border-border hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
            <div className="relative overflow-hidden aspect-square">
                <img
                    src={image}
                    alt={name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
            </div>
            <CardContent className="p-6 space-y-3">
                <h3 className="text-xl font-semibold text-foreground">{name}</h3>
                <p className="text-sm text-muted-foreground line-clamp-2">{description}</p>
                <div className="flex items-center justify-between pt-2">
                    <span className="text-2xl font-bold text-accent">{price}</span>
                    <Button variant="default" size="sm" className="bg-accent hover:bg-accent/90 text-accent-foreground">
                        Add to Cart
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
};

export default ProductCard;
