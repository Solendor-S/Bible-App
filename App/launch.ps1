Add-Type -AssemblyName PresentationFramework
Add-Type -AssemblyName PresentationCore
Add-Type -AssemblyName WindowsBase
Add-Type -AssemblyName System.Windows.Forms

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Load icon
$iconPath = Join-Path $scriptDir "..\..\resources\icon.png"
$iconSource = $null
if (Test-Path $iconPath) {
    $iconSource = [System.Windows.Media.Imaging.BitmapImage]::new([uri]$iconPath)
}

# Build XAML
$xaml = @'
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Width="380" Height="240"
        WindowStyle="None" ResizeMode="NoResize"
        WindowStartupLocation="CenterScreen"
        Topmost="True" AllowsTransparency="True"
        Background="Transparent">
  <Border CornerRadius="10" Background="#1a1a1a"
          BorderBrush="#2a2a2a" BorderThickness="1">
    <StackPanel VerticalAlignment="Center" HorizontalAlignment="Center">
      <Image x:Name="AppIcon" Width="72" Height="72" Stretch="UniformToFill"
             Margin="0,0,0,16">
        <Image.Clip>
          <RectangleGeometry RadiusX="14" RadiusY="14" Rect="0,0,72,72"/>
        </Image.Clip>
      </Image>
      <TextBlock Text="Bible Study"
                 Foreground="#e5e7eb" FontSize="17" FontWeight="SemiBold"
                 TextAlignment="Center" Margin="0,0,0,5"
                 FontFamily="Segoe UI"/>
      <TextBlock Text="Church Fathers · Commentary · History"
                 Foreground="#6b7280" FontSize="11"
                 TextAlignment="Center" Margin="0,0,0,24"
                 FontFamily="Segoe UI"/>
      <StackPanel Orientation="Horizontal" HorizontalAlignment="Center">
        <Ellipse x:Name="Dot1" Width="6" Height="6" Fill="#4b5563" Margin="0,0,7,0"/>
        <Ellipse x:Name="Dot2" Width="6" Height="6" Fill="#4b5563" Margin="0,0,7,0"/>
        <Ellipse x:Name="Dot3" Width="6" Height="6" Fill="#4b5563"/>
      </StackPanel>
    </StackPanel>
  </Border>
</Window>
'@

$reader = [System.Xml.XmlReader]::Create([System.IO.StringReader]::new($xaml))
$window = [System.Windows.Markup.XamlReader]::Load($reader)

if ($iconSource) {
    $window.FindName('AppIcon').Source = $iconSource
}

# Dot animation — cycle active dot with color
$dots = @(
    $window.FindName('Dot1'),
    $window.FindName('Dot2'),
    $window.FindName('Dot3')
)
$script:dotIndex = 0
$dotActive   = [System.Windows.Media.SolidColorBrush]::new([System.Windows.Media.Color]::FromRgb(0x9c, 0xa3, 0xaf))
$dotInactive = [System.Windows.Media.SolidColorBrush]::new([System.Windows.Media.Color]::FromRgb(0x4b, 0x55, 0x63))

$animTimer = [System.Windows.Threading.DispatcherTimer]::new()
$animTimer.Interval = [TimeSpan]::FromMilliseconds(350)
$animTimer.Add_Tick({
    for ($i = 0; $i -lt 3; $i++) {
        $dots[$i].Fill = if ($i -eq $script:dotIndex) { $dotActive } else { $dotInactive }
    }
    $script:dotIndex = ($script:dotIndex + 1) % 3
})
$animTimer.Start()

# Start npm run dev hidden
$psi = [System.Diagnostics.ProcessStartInfo]::new()
$psi.FileName = 'cmd.exe'
$psi.Arguments = "/c cd /d `"$scriptDir`" && npm run dev"
$psi.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden
$psi.CreateNoWindow = $true
[System.Diagnostics.Process]::Start($psi) | Out-Null

# Poll for electron.exe — close splash when it appears
$script:pollCount = 0
$pollTimer = [System.Windows.Threading.DispatcherTimer]::new()
$pollTimer.Interval = [TimeSpan]::FromMilliseconds(1500)
$pollTimer.Add_Tick({
    $script:pollCount++
    $found = [System.Diagnostics.Process]::GetProcessesByName('electron')
    if ($found.Count -gt 0 -or $script:pollCount -ge 40) {
        $pollTimer.Stop()
        $animTimer.Stop()
        $window.Close()
    }
})
$pollTimer.Start()

$window.ShowDialog() | Out-Null
