import pandas as pd
from billing.models import Product

df = pd.read_excel("products_sample.xlsx")

for _, row in df.iterrows():
    Product.objects.create(
        product_id=row["product_id"],
        name=row["name"],
        stock=row["stock"],
        price=row["price"],
        tax_percentage=row["tax_percentage"]
    )

print("Products Imported Successfully!")