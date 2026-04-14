from django.urls import path
from .views import GenerateBill, UploadProducts, ProductList

urlpatterns = [
    path('generate-bill/', GenerateBill.as_view()),
    path('upload-products/', UploadProducts.as_view()),
    path('products/', ProductList.as_view()),
]