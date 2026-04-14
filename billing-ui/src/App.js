import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  TextField,
  Button,
  Card,
  Typography,
  Grid,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Autocomplete,
  Box
} from "@mui/material";

const denominationsList = [500, 200, 100, 50, 20, 10, 5, 2, 1];

function App() {
  const [page, setPage] = useState(1);
  const [email, setEmail] = useState("");
  const [products, setProducts] = useState([]);

  const [items, setItems] = useState([
    { product_id: "", name: "", price: 0, tax: 0, quantity: "", total: 0 }
  ]);

  const [denominations, setDenominations] = useState({});
  const [paid, setPaid] = useState("");
  const [result, setResult] = useState(null);

  const [openUpload, setOpenUpload] = useState(false);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    axios.get("/products/")
      .then(res => setProducts(res.data));
  }, []);

  const addItem = () => {
    setItems([
      ...items,
      { product_id: "", name: "", price: 0, tax: 0, quantity: "", total: 0 }
    ]);
  };

  const removeLastItem = () => {
    if (items.length > 1) {
      setItems(items.slice(0, -1));
    }
  };

  const handleProductSelect = (index, product) => {
    if (!product) return;

    const updated = [...items];
    updated[index] = {
      ...updated[index],
      product_id: product.product_id,
      name: product.name,
      price: product.price,
      tax: product.tax_percentage
    };
    setItems(updated);
  };

  const handleItemChange = (index, field, value) => {
    const updated = [...items];
    updated[index][field] = value;

    const qty = parseInt(updated[index].quantity || 0);
    const price = parseFloat(updated[index].price || 0);
    const tax = parseFloat(updated[index].tax || 0);

    const base = qty * price;
    const taxAmount = base * (tax / 100);

    updated[index].total = base + taxAmount;

    setItems(updated);
  };

  const handleDenominationChange = (value, count) => {
    setDenominations({
      ...denominations,
      [value]: count
    });
  };

  const grandTotal = items.reduce((sum, item) => sum + (item.total || 0), 0);

  const generateBill = async () => {

    const validItems = items.filter(
      (item) => item.product_id && item.quantity
    );

    if (!email) {
      alert("Please enter email");
      return;
    }

    if (validItems.length === 0) {
      alert("Please add at least one valid product");
      return;
    }

    // ✅ NEW VALIDATION
    if (parseFloat(paid || 0) < grandTotal) {
      alert("⚠️ Paid amount is less than total amount");
      return;
    }

    if (denominationTotal !== parseFloat(paid || 0)) {
      alert("⚠️ Denomination total must match paid amount");
      return;
    }

    try {
      setLoading(true);

      const res = await axios.post(
        "/generate-bill/",
        {
          email,
          items: validItems,
          paid_amount: paid,
          denominations
        }
      );

      setResult(res.data);
      setPage(2);

    } catch (err) {
      alert(err.response?.data?.error || "Error generating bill");
    } finally {
      setLoading(false);
    }
  };

  const uploadFile = async () => {
    if (!file) return alert("Select file");

    const formData = new FormData();
    formData.append("file", file);

    try {
      setLoading(true);
      await axios.post("/upload-products/", formData);
      alert("Uploaded successfully");
      setOpenUpload(false);
    } catch {
      alert("Upload failed");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setEmail("");
    setItems([{ product_id: "", name: "", price: 0, tax: 0, quantity: "", total: 0 }]);
    setPaid("");
    setDenominations({});
  };

  const denominationTotal = Object.entries(denominations).reduce(
    (sum, [value, count]) => sum + (parseInt(value) * parseInt(count || 0)),
    0
  );

  const formatKey = (key) => {
    return key
      .replace(/_/g, " ")                 // replace underscore
      .replace(/\b\w/g, (char) => char.toUpperCase()); // capitalize
  };

  return (
    <Box sx={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #667eea, #764ba2)",
      p: 4
    }}>

      {/* Loader */}
      {loading && (
        <Box sx={{
          position: "fixed",
          top: 0, left: 0,
          width: "100%", height: "100%",
          background: "rgba(0,0,0,0.4)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 9999
        }}>
          <CircularProgress sx={{ color: "#fff" }} />
        </Box>
      )}

      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" color="#fff" fontWeight="bold">
          💳 Smart Billing System
        </Typography>

        <Button
          variant="contained"
          sx={{ background: "#fff", color: "#333", fontWeight: "bold" }}
          onClick={() => setOpenUpload(true)}
        >
          Upload Products
        </Button>
      </Box>

      {/* Main Card */}
      <Card sx={{
        p: 4,
        maxWidth: 1200,
        mx: "auto",
        borderRadius: 4,
        backdropFilter: "blur(12px)",
        background: "rgba(255,255,255,0.95)"
      }}>

        {/* PAGE 1 */}
        {page === 1 && (
          <>
            {/* Email */}
            <TextField
              fullWidth
              label="Customer Email"
              variant="outlined"
              sx={{ mb: 3 }}
              onChange={(e) => setEmail(e.target.value)}
            />

            {/* Table Header */}
            <Box sx={{
              display: "grid",
              gridTemplateColumns: "3fr 2fr 1fr 2fr 1fr 2fr",
              fontWeight: "bold",
              borderBottom: "2px solid #ddd",
              pb: 1
            }}>
              <div>Product</div>
              <div>Name</div>
              <div>Qty</div>
              <div>Price</div>
              <div>Tax %</div>
              <div>Total</div>
            </Box>

            {/* Rows */}
            {items.map((item, i) => (
              <Box key={i} sx={{
                display: "grid",
                gridTemplateColumns: "3fr 2fr 1fr 2fr 1fr 2fr",
                gap: 1,
                mt: 2
              }}>

                <Autocomplete
                  options={products}
                  getOptionLabel={(o) => `${o.product_id} - ${o.name}`}
                  onChange={(e, val) => handleProductSelect(i, val)}
                  renderInput={(params) => <TextField {...params} size="small" />}
                />

                <TextField value={item.name} size="small" disabled />

                <TextField
                  size="small"
                  type="number"
                  onChange={(e) =>
                    handleItemChange(i, "quantity", e.target.value)
                  }
                />

                <TextField value={item.price} size="small" disabled />

                <TextField value={item.tax} size="small" disabled />

                <TextField value={item.total.toFixed(2)} size="small" disabled />
              </Box>
            ))}

            {/* Add / Remove */}
            <Box mt={3} display="flex" gap={2} sx={{ mt: 2 }}>
              <Button variant="contained" onClick={addItem} sx={{ mr: 2 }}>
                ➕ Add Product
              </Button>

              <Button variant="outlined" color="error" onClick={removeLastItem}>
                ➖ Remove Last
              </Button>
            </Box>

            {/* Total */}
            <Box sx={{
              mt: 3,
              textAlign: "right",
              fontSize: 22,
              fontWeight: "bold",
              color: "#4CAF50"
            }}>
              Total: ₹{grandTotal.toFixed(2)}
            </Box>

            <Divider sx={{ my: 3 }} />

            {/* Denominations */}
            <Typography variant="h6" mb={1}>💰 Denominations</Typography>

            <Box sx={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 2
            }}>
              {denominationsList.map((d) => (
                <TextField
                  key={d}
                  size="small"
                  label={`₹${d}`}
                  onChange={(e) =>
                    handleDenominationChange(d, e.target.value)
                  }
                />
              ))}
            </Box>

            {/* Paid */}
            <TextField
              fullWidth
              label="Paid Amount"
              sx={{ mt: 3 }}
              onChange={(e) => setPaid(e.target.value)}
            />

            {/* Paid amount warning message */}
            {paid && parseFloat(paid) < grandTotal && (
              <Typography color="error" mt={1}>
                ⚠️ Paid amount is less than total amount
              </Typography>
            )}

            {/* Actions */}
            <Box mt={3} display="flex" justifyContent="flex-end" sx={{ mt: 2 }}>
              <Button variant="outlined" onClick={handleCancel} sx={{ mr: 2 }}>
                Cancel
              </Button>

              <Button
                variant="contained"
                onClick={generateBill}
                sx={{ background: "#4CAF50" }}
              >
                Generate Bill
              </Button>
            </Box>
          </>
        )}

        {/* PAGE 2 */}
        {page === 2 && result && (
          <>
            <Typography variant="h6" gutterBottom>
              📧 {email}
            </Typography>

            <Divider sx={{ my: 2 }} />

            <Box sx={{ textAlign: "right" }}>
              <Typography fontSize={18}>
                Total: ₹{result.summary?.rounded_total}
              </Typography>

              <Typography fontSize={18} color="green">
                Balance: ₹{result.summary?.balance}
              </Typography>
            </Box>

            <Divider sx={{ my: 2 }} />

            <Typography variant="h6">💵 Denomination</Typography>

            {Object.entries(result.denominations || {}).map(([k, v]) => (
              <Typography key={k}>
                ₹{formatKey(k)} : {v}
              </Typography>
            ))}

            <Box mt={3}>
              <Button variant="contained" onClick={() => setPage(1)}>
                Back
              </Button>
            </Box>
          </>
        )}
      </Card>

      {/* Upload Dialog */}
      <Dialog open={openUpload} onClose={() => setOpenUpload(false)}>
        <DialogTitle>Upload Excel</DialogTitle>
        <DialogContent>
          <input type="file" onChange={(e) => setFile(e.target.files[0])} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenUpload(false)}>Cancel</Button>
          <Button onClick={uploadFile}>Upload</Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
}

export default App;