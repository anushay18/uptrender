import PlatformSettings from '../models/PlatformSettings.js';
import path from 'path';
import fs from 'fs';

// Get platform settings
export const getPlatformSettings = async (req, res) => {
  try {
    let settings = await PlatformSettings.findOne();

    // Create default settings if none exist
    if (!settings) {
      settings = await PlatformSettings.create({
        platform_name: 'Uptrender',
        logo_alt_text: 'Platform Logo',
      });
    }

    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error('Error fetching platform settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch platform settings',
      error: error.message
    });
  }
};

// Update platform settings
export const updatePlatformSettings = async (req, res) => {
  try {
    const {
      logo_alt_text,
      logo_link_url,
      platform_name,
    } = req.body;

    let settings = await PlatformSettings.findOne();

    const updateData = {};

    if (logo_alt_text !== undefined) {
      updateData.logo_alt_text = logo_alt_text;
    }

    if (logo_link_url !== undefined) {
      updateData.logo_link_url = logo_link_url;
    }

    if (platform_name !== undefined) {
      updateData.platform_name = platform_name;
    }

    // Handle logo upload if file is present
    if (req.file) {
      updateData.logo_url = `/uploads/logos/${req.file.filename}`;
    }

    if (settings) {
      await settings.update(updateData);
    } else {
      settings = await PlatformSettings.create(updateData);
    }

    res.json({
      success: true,
      message: 'Platform settings updated successfully',
      data: settings
    });
  } catch (error) {
    console.error('Error updating platform settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update platform settings',
      error: error.message
    });
  }
};

// Upload logo
export const uploadLogo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    let settings = await PlatformSettings.findOne();
    const logoUrl = `/uploads/logos/${req.file.filename}`;

    if (settings) {
      // Delete old logo if exists
      if (settings.logo_url) {
        const oldLogoPath = path.join(process.cwd(), 'uploads', 'logos', path.basename(settings.logo_url));
        if (fs.existsSync(oldLogoPath)) {
          fs.unlinkSync(oldLogoPath);
        }
      }
      await settings.update({ logo_url: logoUrl });
    } else {
      settings = await PlatformSettings.create({ logo_url: logoUrl });
    }

    res.json({
      success: true,
      message: 'Logo uploaded successfully',
      data: settings
    });
  } catch (error) {
    console.error('Error uploading logo:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload logo',
      error: error.message
    });
  }
};

// Remove logo
export const removeLogo = async (req, res) => {
  try {
    let settings = await PlatformSettings.findOne();

    if (!settings) {
      return res.status(404).json({
        success: false,
        message: 'No settings found'
      });
    }

    // Delete logo file if exists
    if (settings.logo_url) {
      const logoPath = path.join(process.cwd(), 'uploads', 'logos', path.basename(settings.logo_url));
      if (fs.existsSync(logoPath)) {
        fs.unlinkSync(logoPath);
      }
    }

    // Clear logo_url from database
    await settings.update({ logo_url: null });
    
    // Reload settings to get the updated data
    await settings.reload();

    res.json({
      success: true,
      message: 'Logo removed successfully',
      data: settings
    });
  } catch (error) {
    console.error('Error removing logo:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove logo',
      error: error.message
    });
  }
};
