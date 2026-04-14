from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser
from rest_framework import status
from django.db import transaction
from django.core.exceptions import ObjectDoesNotExist
from .models import Product, Customer, Order, OrderItem
import pandas as pd
import math
from django.core.mail import EmailMultiAlternatives
from django.conf import settings


# 🔥 PRODUCT LIST (FOR DROPDOWN SEARCH)
class ProductList(APIView):
    def get(self, request):
        search = request.GET.get("search", "")

        products = Product.objects.filter(
            name__icontains=search
        )[:20]

        data = [
            {
                "product_id": p.product_id,
                "name": p.name,
                "price": p.price,
                "tax_percentage": p.tax_percentage,
                "stock": p.stock
            }
            for p in products
        ]

        return Response(data)


def send_invoice_email(email, bill_items, summary):
    subject = "🧾 Your Invoice - Thank You for Your Purchase"

    # 🔥 HTML TABLE ROWS
    rows = ""
    for item in bill_items:
        rows += f"""
        <tr>
            <td>{item['name']}</td>
            <td align="center">{item['quantity']}</td>
            <td align="right">₹{item['unit_price']}</td>
            <td align="right">₹{item['total']}</td>
        </tr>
        """

    # 🔥 HTML EMAIL TEMPLATE
    html_content = f"""
    <html>
    <body style="font-family: Arial, sans-serif; background-color: #f5f7fa; padding: 20px;">
        
        <div style="max-width: 700px; margin: auto; background: #ffffff; padding: 20px; border-radius: 10px;">
            
            <h2 style="text-align: center; color: #4CAF50;">
                🧾 Invoice
            </h2>

            <p>Hi,</p>
            <p>Thank you for your purchase! Here are your billing details:</p>

            <table width="100%" cellspacing="0" cellpadding="8" style="border-collapse: collapse; margin-top: 15px;">
                <thead>
                    <tr style="background-color: #4CAF50; color: white;">
                        <th align="left">Product</th>
                        <th align="center">Qty</th>
                        <th align="right">Price</th>
                        <th align="right">Total</th>
                    </tr>
                </thead>
                <tbody>
                    {rows}
                </tbody>
            </table>

            <hr style="margin: 20px 0;" />

            <div style="text-align: right;">
                <p><strong>Total:</strong> ₹{summary['rounded_total']}</p>
                <p><strong>Balance:</strong> ₹{summary['balance']}</p>
            </div>

            <hr style="margin: 20px 0;" />

            <p style="text-align: center; color: #888;">
                Thank you for shopping with us 🙏<br/>
                Visit again!
            </p>

        </div>

    </body>
    </html>
    """

    # 🔥 FALLBACK TEXT (for safety)
    text_content = f"""
Invoice Summary

Total: ₹{summary['rounded_total']}
Balance: ₹{summary['balance']}
"""

    # 🔥 SEND EMAIL
    msg = EmailMultiAlternatives(
        subject,
        text_content,
        settings.DEFAULT_FROM_EMAIL,
        [email]
    )

    msg.attach_alternative(html_content, "text/html")
    msg.send()


# 🔥 GENERATE BILL
class GenerateBill(APIView):

    @transaction.atomic
    def post(self, request):
        try:
            email = request.data.get("email")
            items = request.data.get("items", [])
            paid_amount = float(request.data.get("paid_amount", 0))
            denomination_input = request.data.get("denominations", {})

            # ✅ VALIDATION
            if not email:
                return Response({"error": "Email is required"}, status=400)

            # Filter valid items
            valid_items = [
                i for i in items
                if i.get("product_id") and str(i.get("quantity")).strip() != ""
            ]

            if not valid_items:
                return Response({"error": "At least one valid item is required"}, status=400)

            customer, _ = Customer.objects.get_or_create(email=email)

            order = Order.objects.create(
                customer=customer,
                total_amount=0,
                paid_amount=paid_amount
            )

            bill_items = []
            total_without_tax = 0
            total_tax = 0

            # ---------------- ITEM CALCULATION ----------------
            for item in valid_items:
                try:
                    product = Product.objects.get(product_id=item["product_id"])
                except ObjectDoesNotExist:
                    return Response(
                        {"error": f"Product {item['product_id']} not found"},
                        status=400
                    )

                try:
                    qty = int(item.get("quantity", 0))
                except ValueError:
                    return Response(
                        {"error": f"Invalid quantity for {product.name}"},
                        status=400
                    )

                if qty <= 0:
                    return Response(
                        {"error": f"Invalid quantity for {product.name}"},
                        status=400
                    )

                # 🔥 STOCK VALIDATION
                if product.stock < qty:
                    return Response(
                        {"error": f"Not enough stock for {product.name}"},
                        status=400
                    )

                unit_price = product.price
                purchase_price = unit_price * qty
                tax_percent = product.tax_percentage
                tax_amount = purchase_price * (tax_percent / 100)

                total_item_price = purchase_price + tax_amount

                total_without_tax += purchase_price
                total_tax += tax_amount

                # Save item
                OrderItem.objects.create(
                    order=order,
                    product=product,
                    quantity=qty
                )

                # Reduce stock
                product.stock -= qty
                product.save()

                bill_items.append({
                    "product_id": product.product_id,
                    "name": product.name,
                    "unit_price": round(unit_price, 2),
                    "quantity": qty,
                    "purchase_price": round(purchase_price, 2),
                    "tax_percent": tax_percent,
                    "tax_amount": round(tax_amount, 2),
                    "total": round(total_item_price, 2)
                })

            # ---------------- TOTAL ----------------
            net_total = total_without_tax + total_tax
            rounded_total = math.floor(net_total)
            balance = paid_amount - rounded_total

            order.total_amount = rounded_total
            order.save()

            # ---------------- DENOMINATION (SAFE FIX) ----------------
            balance_distribution = {}
            remaining = balance

            denominations_sorted = []

            for k, v in denomination_input.items():
                try:
                    value = int(k)
                    count = int(v)

                    if count > 0:
                        denominations_sorted.append((value, count))

                except (ValueError, TypeError):
                    continue  # skip invalid/empty values

            denominations_sorted.sort(reverse=True)

            for value, available in denominations_sorted:
                if remaining <= 0:
                    break

                needed = remaining // value
                used = min(needed, available)

                if used > 0:
                    balance_distribution[value] = int(used)
                    remaining -= value * used

            if remaining > 0:
                balance_distribution["remaining_unsettled"] = remaining

            # ---------------- EMAIL ----------------
            send_invoice_email(email, bill_items, {
                "rounded_total": rounded_total,
                "balance": round(balance, 2)
            })

            # ---------------- RESPONSE ----------------
            return Response({
                "items": bill_items,
                "summary": {
                    "total_without_tax": round(total_without_tax, 2),
                    "total_tax": round(total_tax, 2),
                    "net_total": round(net_total, 2),
                    "rounded_total": rounded_total,
                    "balance": round(balance, 2)
                },
                "denominations": balance_distribution
            })

        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

# 🔥 UPLOAD PRODUCTS (EXCEL)
class UploadProducts(APIView):
    parser_classes = [MultiPartParser]

    def post(self, request):
        file = request.FILES.get('file')

        if not file:
            return Response(
                {"error": "No file uploaded"},
                status=400
            )

        try:
            df = pd.read_excel(file)

            products = []

            for _, row in df.iterrows():
                # Avoid duplicates
                if not Product.objects.filter(product_id=row['product_id']).exists():
                    products.append(Product(
                        product_id=row['product_id'],
                        name=row['name'],
                        stock=row['stock'],
                        price=row['price'],
                        tax_percentage=row['tax_percentage']
                    ))

            Product.objects.bulk_create(products)

            return Response({
                "message": f"{len(products)} products uploaded successfully"
            })

        except Exception as e:
            return Response(
                {"error": str(e)},
                status=500
            )