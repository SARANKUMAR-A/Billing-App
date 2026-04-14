from django.db import models

class Product(models.Model):
    name = models.CharField(max_length=100)
    product_id = models.CharField(max_length=50, unique=True)
    stock = models.IntegerField()
    price = models.FloatField()
    tax_percentage = models.FloatField()

    def __str__(self):
        return self.name


class Customer(models.Model):
    email = models.EmailField(unique=True)

    def __str__(self):
        return self.email


class Order(models.Model):
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE)
    total_amount = models.FloatField()
    paid_amount = models.FloatField()
    created_at = models.DateTimeField(auto_now_add=True)


class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE)
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    quantity = models.IntegerField()


class Denomination(models.Model):
    value = models.IntegerField()
    count = models.IntegerField()