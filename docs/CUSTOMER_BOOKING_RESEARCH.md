# Customer login and appointment booking

Implemented on `/book`, including the header CTA, service links and direct visits.

## Research (3 October 2026)

Primary sources reviewed:
- [Vagaro: customer profile fields](https://support.vagaro.com/hc/en-us/articles/18977250687643-Add-a-New-Customer-Profile): name, mobile/email, address and notification preferences. Its profile creation requires first/last name; other fields are optional.
- [Fresha: adding clients](https://www.fresha.com/help-center/academy/run-your-business/manage-your-clients/lessons/100297): name is required, phone/email recommended; profiles can hold address and communication preferences. Marketing preferences require agreement.
- [Vagaro: customer account creation](https://support.vagaro.com/hc/en-us/articles/115003685133-Create-a-Vagaro-Account-for-Customers-of-a-Vagaro-Business): customer accounts support Marketplace appointment booking.

There is no universal mandatory set. Velora requires name, phone, address, services and an available date/time to meet the requested flow. Email and appointment notes are optional. Stylist may be Any Available. First-visit and contact preferences are collected. No birth date, gender, emergency contact, medical history, card details or marketing consent is requested for ordinary salon bookings.

## Flow

1. Customer login or sign-up: demo number `+91 90000 00000`, demo code `123456`.
2. Services, with combined duration and price.
3. Compatible stylist or Any Available.
4. Branch-local date and actual available time.
5. Name, editable booking phone, optional email and first-visit preference.
6. Street address, city, postal code, country, contact preference and optional appointment notes.
7. Review and accept the displayed appointment/cancellation policy, then confirm with the backend.

The first screen explicitly identifies this as a simulated login. It does not send SMS, verify a phone number, create a backend account, issue a customer JWT or change staff authorization. The demo session is tenant-scoped in sessionStorage and can be logged out; backend private receipts continue to authorize management of the resulting appointment. Replacing this presentation gate with real server customer authentication remains a separate integration.

Address and contact/first-visit preferences are saved as labelled lines in the backend appointment `notes` field, alongside the customer's optional note. Name, phone and email use existing typed customer fields. This avoids a database migration or silently dropping supplied address data. It does not create a reusable address profile. SMS/email delivery remains unconfigured and no successful notification delivery is claimed.

Booking details persist while moving backward and forward within the wizard. Reloading preserves the demo session but clears the unsubmitted booking draft. Customer personal data is not copied into localStorage. Public and staff booking forms remain separate: reception can create bookings without the dummy customer login.
