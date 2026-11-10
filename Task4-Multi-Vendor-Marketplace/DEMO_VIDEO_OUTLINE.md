# Demo Video Outline

Expected length: about 5 minutes. Run `npm run seed` in `server/` first, then start both servers. On the login page in development, buttons fill in each demo account.

| # | Action | Point to make |
|---|---|---|
| 1 | Sign in as `customer@example.com` | The session lives in an HttpOnly cookie |
| 2 | Open Shop. Search, filter by category and sort | Filtering happens in the backend |
| 3 | Open a product's details | Vendor, stock, rating and reviews |
| 4 | Add an Aurora Electronics product (Vendor A) | |
| 5 | Add an Urban Thread Co. product (Vendor B) | Products from different vendors share a cart |
| 6 | Open the cart | Items are grouped per vendor with separate delivery |
| 7 | Go to checkout and enter an address | Totals come from the server |
| 8 | Choose "Simulate successful payment" | Clearly labelled as simulated |
| 9 | View the order | One order, with one shipment per vendor |
| 10 | Sign in as `vendor1@example.com` and open Orders | Only Vendor A's items are visible. Mark Confirmed, Processing, Shipped |
| 11 | Open the vendor dashboard and sales page | Statistics for this store only |
| 12 | Sign in as `vendor2@example.com` and open Orders | Only Vendor B's items are visible. Mark Confirmed |
| 13 | Sign in as the customer again and open the order | The two vendors now show different statuses |
| 14 | Sign in as `admin@example.com` and open Vendors | Approve Paperleaf Stationers; suspend or reactivate another store |
| 15 | Open the Orders page in the admin console | Customer, vendors, fulfillment, payment and totals |
| 16 | Open the admin dashboard | Marketplace statistics |

Optional extra: repeat a checkout and choose "Simulate failed payment" to show that stock is released and the items return to the cart.
